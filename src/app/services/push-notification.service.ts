import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Auth } from '@angular/fire/auth';
import { Firestore, deleteDoc, doc, serverTimestamp, setDoc } from '@angular/fire/firestore';

/**
 * Registra el dispositivo para recibir notificaciones push (FCM) y guarda el
 * token en usuarios/{uid}/fcmTokens/{token}. El envío en sí lo hacen las
 * Cloud Functions (onInvitacionEquipoCreada, onTransferenciaCreada) con el
 * Admin SDK — este servicio solo se encarga del lado del dispositivo.
 *
 * Solo funciona en la app nativa (Android/iOS): la contraparte web (push en
 * navegador/PWA) necesitaría además un service worker de Firebase Messaging
 * y una VAPID key, que no está configurada todavía.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly auth = inject(Auth);
  private readonly firestore = inject(Firestore);
  private readonly router = inject(Router);

  private readonly isNative = Capacitor.isNativePlatform();
  private inicializado = false;
  private tokenActual: string | null = null;

  /** Pide permiso (si todavía no se pidió) y registra el token. Se puede
   *  llamar en cada arranque de sesión: si ya está todo hecho, no vuelve a
   *  molestar — solo re-registra el token por si cambió. */
  async init(): Promise<void> {
    if (!this.isNative || this.inicializado) return;
    this.inicializado = true;

    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');

      let estado = (await PushNotifications.checkPermissions()).receive;
      if (estado === 'prompt' || estado === 'prompt-with-rationale') {
        estado = (await PushNotifications.requestPermissions()).receive;
      }
      if (estado !== 'granted') return;

      PushNotifications.addListener('registration', (token) => {
        this.guardarToken(token.value).catch(err =>
          console.error('No se pudo guardar el token de push', err)
        );
      });

      PushNotifications.addListener('registrationError', (err) => {
        console.error('Error registrando push notifications', err);
      });

      // Notificación tocada estando la app en segundo plano o cerrada: la
      // llevamos a la pantalla de notificaciones.
      PushNotifications.addListener('pushNotificationActionPerformed', () => {
        this.router.navigate(['/tabs/notificaciones']);
      });

      await PushNotifications.register();
    } catch (err) {
      console.error('No se pudo inicializar push notifications', err);
    }
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
    if (!this.isNative || !this.tokenActual) return;
    const uid = this.auth.currentUser?.uid;
    if (!uid) return;
    try {
      await deleteDoc(doc(this.firestore, `usuarios/${uid}/fcmTokens/${this.tokenActual}`));
    } catch {
      /* no crítico */
    } finally {
      this.tokenActual = null;
    }
  }
}
