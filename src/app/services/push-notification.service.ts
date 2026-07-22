import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, deleteDoc, doc, serverTimestamp, setDoc } from '@angular/fire/firestore';
import { environment } from 'src/environments/environment';
import type { Messaging } from 'firebase/messaging';

/**
 * Registra el dispositivo para recibir notificaciones push (FCM) y guarda el
 * token en usuarios/{uid}/fcmTokens/{token}. El envío en sí lo hacen las
 * Cloud Functions (onInvitacionEquipoCreada, onTransferenciaCreada) con el
 * Admin SDK — este servicio solo se encarga del lado del dispositivo.
 *
 * En la app nativa (Android/iOS) usa @capacitor-firebase/messaging (no
 * @capacitor/push-notifications) porque en iOS necesitamos que el token
 * entregado sea un token FCM real (el SDK de Firebase hace el puente
 * APNs→FCM internamente); el plugin core de Capacitor solo entrega el
 * token crudo de APNs, que el backend no entiende.
 *
 * En web (incluyendo Safari/iOS agregado a la pantalla de inicio, que es la
 * única forma de tener push en iPhone sin cuenta de Apple Developer) usa el
 * SDK de Firebase para JS con Web Push (VAPID) + el service worker
 * src/firebase-messaging-sw.js. Safari solo expone `PushManager` cuando el
 * sitio está instalado como app (no en una pestaña normal), así que ahí
 * queda desactivado solo, sin romper nada.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  private readonly isNative = Capacitor.isNativePlatform();
  private inicializado = false;
  private tokenActual: string | null = null;
  private messagingWeb: Messaging | null = null;

  /** Pide permiso (si todavía no se pidió) y registra el token. Se puede
   *  llamar en cada arranque de sesión: si ya está todo hecho, no vuelve a
   *  molestar — solo re-registra el token por si cambió. */
  async init(): Promise<void> {
    if (this.inicializado) return;
    this.inicializado = true;

    if (this.isNative) {
      await this.initNativo();
    } else {
      await this.initWeb();
    }
  }

  private async initNativo(): Promise<void> {
    try {
      const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

      let estado = (await FirebaseMessaging.checkPermissions()).receive;
      if (estado === 'prompt' || estado === 'prompt-with-rationale') {
        estado = (await FirebaseMessaging.requestPermissions()).receive;
      }
      if (estado !== 'granted') return;

      FirebaseMessaging.addListener('tokenReceived', (event) => {
        this.guardarToken(event.token).catch(err =>
          console.error('No se pudo guardar el token de push', err)
        );
      });

      // Notificación tocada estando la app en segundo plano o cerrada: la
      // llevamos a la ruta que mandó la Cloud Function (data.ruta), o a
      // Notificaciones si no vino ninguna.
      FirebaseMessaging.addListener('notificationActionPerformed', (event) => {
        const data = event.notification.data as Record<string, string> | undefined;
        const ruta = data?.['ruta'] || '/tabs/notificaciones';
        this.router.navigateByUrl(ruta);
      });

      const { token } = await FirebaseMessaging.getToken();
      await this.guardarToken(token);
    } catch (err) {
      console.error('No se pudo inicializar push notifications', err);
    }
  }

  private async initWeb(): Promise<void> {
    if (!environment.webPushVapidKey) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      const { getApp } = await import('firebase/app');
      const { getMessaging, getToken, onMessage } = await import('firebase/messaging');

      let permiso = Notification.permission;
      if (permiso === 'default') {
        permiso = await Notification.requestPermission();
      }
      if (permiso !== 'granted') return;

      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      this.messagingWeb = getMessaging(getApp());

      const token = await getToken(this.messagingWeb, {
        vapidKey: environment.webPushVapidKey,
        serviceWorkerRegistration: registration,
      });
      if (token) await this.guardarToken(token);

      // Notificación recibida con la app en primer plano: no hace falta
      // mostrarla aparte, la campanita ya la refleja en tiempo real.
      onMessage(this.messagingWeb, () => {});
    } catch (err) {
      console.error('No se pudo inicializar push notifications (web)', err);
    }
  }

  /** Estado actual del permiso de notificaciones, para mostrar en
   *  Configuración sin volver a pedirlo. */
  async obtenerEstadoPermiso(): Promise<'concedido' | 'denegado' | 'no-pedido' | 'no-soportado'> {
    if (this.isNative) {
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        const estado = (await FirebaseMessaging.checkPermissions()).receive;
        if (estado === 'granted') return 'concedido';
        if (estado === 'denied') return 'denegado';
        return 'no-pedido';
      } catch {
        return 'no-soportado';
      }
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return 'no-soportado';
    }
    if (Notification.permission === 'granted') return 'concedido';
    if (Notification.permission === 'denied') return 'denegado';
    return 'no-pedido';
  }

  /** Activa el push desde el toggle de Configuración: fuerza un nuevo
   *  intento aunque ya se haya llamado init() antes en esta sesión (p. ej.
   *  el usuario lo había rechazado al loguearse y ahora lo quiere activar). */
  async activar(): Promise<boolean> {
    this.inicializado = false;
    await this.init();
    return !!this.tokenActual;
  }

  private async guardarToken(token: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid || !token) return;
    this.tokenActual = token;
    await setDoc(doc(this.firestore, `usuarios/${uid}/fcmTokens/${token}`), {
      token,
      plataforma: Capacitor.getPlatform(),
      actualizadoEn: serverTimestamp(),
    });
  }

  /** Se llama al cerrar sesión: borra el token de este dispositivo de la
   *  cuenta, para dejar de mandarle push a alguien que ya no tiene sesión
   *  iniciada acá. Best-effort: si falla (sin red, etc.) no bloquea el
   *  logout — en el peor caso el token queda huérfano hasta que la Cloud
   *  Function lo limpie sola al detectar que ya no es válido. */
  async olvidarTokenActual(): Promise<void> {
    if (!this.tokenActual) return;
    const uid = this.auth.currentUser?.uid;
    const token = this.tokenActual;
    this.tokenActual = null;
    if (!uid) return;
    try {
      if (this.isNative) {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');
        await FirebaseMessaging.deleteToken();
      } else if (this.messagingWeb) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(this.messagingWeb);
      }
      await deleteDoc(doc(this.firestore, `usuarios/${uid}/fcmTokens/${token}`));
    } catch {
      /* no crítico: en el peor caso el token queda huérfano hasta que la
       * Cloud Function lo limpie sola al detectar que ya no es válido */
    }
  }
}
