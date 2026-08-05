import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { AlertController, ToastController } from '@ionic/angular';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  colorPaletteOutline, notificationsOutline, shieldCheckmarkOutline,
  personOutline, pawOutline, warningOutline, textOutline, moonOutline,
  sunnyOutline, cameraOutline, locationOutline, keyOutline, trashOutline,
  chevronForwardOutline, checkmarkCircle, closeCircle, helpCircleOutline,
  logOutOutline, peopleOutline, languageOutline,
} from 'ionicons/icons';
import { Capacitor } from '@capacitor/core';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { PushNotificationService } from '../services/push-notification.service';
import { PreferenciasService, Tema, TamanoTexto, Idioma } from '../services/preferencias.service';

type EstadoPermiso = 'concedido' | 'denegado' | 'no-pedido' | 'no-soportado';

@Component({
  selector: 'app-configuracion',
  standalone: true,
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonToggle,
    IonSegment, IonSegmentButton, IonSpinner,
    TranslatePipe,
  ],
})
export class ConfiguracionComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly push = inject(PushNotificationService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  email = '';
  esCuentaGoogle = false;

  /** Refugios ajenos de cuyo equipo formo parte (para poder salir). Ver, en
   *  cambio, cómo va el trabajo del refugio vive en el panel del refugio
   *  (tab "Refugio" del nav), no acá. */
  refugiosEnLosQueColaboro: string[] = [];
  nombresRefugios: Record<string, string> = {};

  tema: Tema = this.preferencias.tema;
  tamanoTexto: TamanoTexto = this.preferencias.tamanoTexto;
  idioma: Idioma = this.preferencias.idioma;

  estadoNotificaciones: EstadoPermiso = 'no-pedido';
  cargandoNotificaciones = false;

  /** iPhone/iPad en Safari (no en la app nativa): Safari solo expone
   *  notificaciones push si el sitio está agregado a la pantalla de inicio
   *  — a diferencia de Android/Chrome, iOS no tiene un prompt nativo de
   *  instalación, así que sin este aviso el toggle queda "no soportado"
   *  sin que la persona entienda por qué ni cómo arreglarlo. */
  readonly esIOSWeb = this.detectarIOSWeb();
  readonly instaladoComoApp = this.detectarInstaladoComoApp();

  estadoCamara: EstadoPermiso = 'no-pedido';
  estadoUbicacion: EstadoPermiso = 'no-pedido';

  enviandoResetPassword = false;
  eliminando = false;

  constructor() {
    addIcons({
      colorPaletteOutline, notificationsOutline, shieldCheckmarkOutline,
      personOutline, pawOutline, warningOutline, textOutline, moonOutline,
      sunnyOutline, cameraOutline, locationOutline, keyOutline, trashOutline,
      chevronForwardOutline, checkmarkCircle, closeCircle, helpCircleOutline,
      logOutOutline, peopleOutline, languageOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const user = this.auth.getCurrentUser();
    this.email = user?.email ?? '';
    this.esCuentaGoogle = user?.providerData?.[0]?.providerId === 'google.com';

    this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
    await this.leerPermisosNavegador();

    if (user) this.cargarEquiposEnLosQueColaboro(user.uid);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarEquiposEnLosQueColaboro(uid: string): void {
    this.firestoreService.getMisRefugios(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(refugios => {
        this.refugiosEnLosQueColaboro = refugios;
        refugios.forEach(refugioUid => {
          if (this.nombresRefugios[refugioUid]) return;
          this.firestoreService.getDocument(`usuarios/${refugioUid}`).then(perfil => {
            this.nombresRefugios[refugioUid] = perfil?.nombreRefugio?.trim() || 'Refugio';
          });
        });
      });
  }

  private async leerPermisosNavegador(): Promise<void> {
    const permissions = (navigator as any).permissions;
    if (!permissions?.query) {
      this.estadoCamara = 'no-soportado';
      this.estadoUbicacion = 'no-soportado';
      return;
    }
    try {
      const camara = await permissions.query({ name: 'camera' as PermissionName });
      this.estadoCamara = camara.state === 'granted' ? 'concedido' : camara.state === 'denied' ? 'denegado' : 'no-pedido';
    } catch {
      this.estadoCamara = 'no-soportado';
    }
    try {
      const ubicacion = await permissions.query({ name: 'geolocation' });
      this.estadoUbicacion = ubicacion.state === 'granted' ? 'concedido' : ubicacion.state === 'denied' ? 'denegado' : 'no-pedido';
    } catch {
      this.estadoUbicacion = 'no-soportado';
    }
  }

  // ── Apariencia ───────────────────────────────────────────────────────────
  cambiarTema(tema: string | number | undefined): void {
    if (tema !== 'oscuro' && tema !== 'claro') return;
    this.tema = tema;
    this.preferencias.setTema(tema);
  }

  cambiarTamanoTexto(tamano: string | number | undefined): void {
    if (tamano !== 'pequeno' && tamano !== 'normal' && tamano !== 'grande' && tamano !== 'muy-grande') return;
    this.tamanoTexto = tamano;
    this.preferencias.setTamanoTexto(tamano);
  }

  cambiarIdioma(idioma: string | number | undefined): void {
    if (idioma !== 'es' && idioma !== 'en') return;
    this.idioma = idioma;
    this.preferencias.setIdioma(idioma);
  }

  // ── Notificaciones ───────────────────────────────────────────────────────
  async alternarNotificaciones(activar: boolean): Promise<void> {
    this.cargandoNotificaciones = true;
    try {
      if (activar) {
        const ok = await this.push.activar();
        this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
        if (!ok && this.estadoNotificaciones !== 'denegado') {
          await this.mostrarToast('No se pudo activar. Intenta nuevamente.', 'warning');
        }
      } else {
        await this.push.olvidarTokenActual();
        this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
      }
    } finally {
      this.cargandoNotificaciones = false;
    }
  }

  // ── Cámara / Ubicación ───────────────────────────────────────────────────
  // Preferencia propia de Ashbis (no el permiso real del navegador, que
  // nunca se puede revocar por código): si está apagada, la app no llama a
  // esas APIs aunque el permiso del navegador siga concedido.
  get camaraHabilitada(): boolean {
    return this.preferencias.camaraHabilitada;
  }

  get ubicacionHabilitada(): boolean {
    return this.preferencias.ubicacionHabilitada;
  }

  alternarCamara(activar: boolean): void {
    this.preferencias.setCamaraHabilitada(activar);
  }

  alternarUbicacion(activar: boolean): void {
    this.preferencias.setUbicacionHabilitada(activar);
  }

  // ── Cuenta ───────────────────────────────────────────────────────────────
  async cambiarContrasena(): Promise<void> {
    if (!this.email) return;
    this.enviandoResetPassword = true;
    try {
      await this.auth.resetPassword(this.email);
      await this.mostrarToast('Te enviamos un correo para cambiar tu contraseña.', 'success');
    } catch {
      await this.mostrarToast('No se pudo enviar el correo. Intenta más tarde.', 'danger');
    } finally {
      this.enviandoResetPassword = false;
    }
  }

  irAEditarPerfil(): void {
    this.router.navigate(['/tabs/perfil']);
  }

  async cerrarSesion(): Promise<void> {
    await this.push.olvidarTokenActual();
    await this.auth.logout();
    await this.router.navigate(['/login'], { replaceUrl: true });
  }

  irAMisMascotas(): void {
    this.router.navigate(['/tabs/listar-mascotas']);
  }

  irAGuia(): void {
    this.router.navigate(['/tabs/guia']);
  }

  irAPrivacidad(): void {
    this.router.navigate(['/privacidad']);
  }

  // ── Equipos en los que colaboro ──────────────────────────────────────────
  async salirDelEquipo(refugioUid: string): Promise<void> {
    const user = this.auth.getCurrentUser();
    if (!user) return;
    const nombre = this.nombresRefugios[refugioUid] || 'este refugio';
    const alert = await this.alertCtrl.create({
      header: 'Salir del equipo',
      message: `¿Salir del equipo de ${nombre}? Vas a perder el acceso para operar su cuenta.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Salir',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.quitarMiembroEquipo(refugioUid, user.uid);
              await this.mostrarToast('Saliste del equipo.', 'success');
            } catch {
              await this.mostrarToast('No se pudo salir del equipo. Intenta nuevamente.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // ── Zona irreversible ────────────────────────────────────────────────────
  async eliminarCuenta(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Eliminar cuenta',
      message: 'Esta acción eliminará permanentemente tu cuenta y todos los datos de tus mascotas. No se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            this.eliminando = true;
            try {
              await this.firestoreService.eliminarCuenta();
              await this.auth.logout();
              await this.router.navigate(['/login'], { replaceUrl: true });
            } catch (e) {
              console.error('Error al eliminar cuenta:', e);
              await this.mostrarToast('No se pudo eliminar la cuenta. Intenta más tarde.', 'danger');
            } finally {
              this.eliminando = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async mostrarToast(message: string, color: 'success' | 'danger' | 'warning'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 3000, color, position: 'bottom' });
    await toast.present();
  }

  /** true en Safari de iPhone/iPad (incluye iPadOS 13+, que se reporta como
   *  Mac pero tiene pantalla táctil) corriendo como pestaña web normal —
   *  nunca en la app nativa empaquetada con Capacitor. */
  private detectarIOSWeb(): boolean {
    if (Capacitor.isNativePlatform()) return false;
    const ua = navigator.userAgent;
    const esIOS = /iPad|iPhone|iPod/.test(ua);
    const esIPadOSComoMac = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    return esIOS || esIPadOSComoMac;
  }

  private detectarInstaladoComoApp(): boolean {
    return window.matchMedia?.('(display-mode: standalone)').matches
      || (navigator as any).standalone === true;
  }
}
