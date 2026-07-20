import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
import { addIcons } from 'ionicons';
import {
  colorPaletteOutline, notificationsOutline, shieldCheckmarkOutline,
  personOutline, pawOutline, warningOutline, textOutline, moonOutline,
  sunnyOutline, cameraOutline, locationOutline, keyOutline, trashOutline,
  chevronForwardOutline, checkmarkCircle, closeCircle, helpCircleOutline,
} from 'ionicons/icons';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { PushNotificationService } from '../services/push-notification.service';
import { PreferenciasService, Tema, TamanoTexto } from '../services/preferencias.service';

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
  ],
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly push = inject(PushNotificationService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);

  email = '';
  esCuentaGoogle = false;

  tema: Tema = this.preferencias.tema;
  tamanoTexto: TamanoTexto = this.preferencias.tamanoTexto;

  estadoNotificaciones: EstadoPermiso = 'no-pedido';
  cargandoNotificaciones = false;

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
    });
  }

  async ngOnInit(): Promise<void> {
    const user = this.auth.getCurrentUser();
    this.email = user?.email ?? '';
    this.esCuentaGoogle = user?.providerData?.[0]?.providerId === 'google.com';

    this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
    await this.leerPermisosNavegador();
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

  irAMisMascotas(): void {
    this.router.navigate(['/tabs/listar-mascotas']);
  }

  irAGuia(): void {
    this.router.navigate(['/tabs/guia']);
  }

  irAPrivacidad(): void {
    this.router.navigate(['/privacidad']);
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
}
