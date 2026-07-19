import { Component, inject, signal, OnDestroy } from '@angular/core';
import { NgIf, NgFor, TitleCasePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonGrid, IonRow, IonCol,
  IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText,
  IonCard, IonCardContent,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { addIcons } from 'ionicons';
import { alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { VeterinariaFavorita } from 'src/app/firebase/firestore';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { SecurityService } from 'src/app/services/security.service';

@Component({
  selector: 'app-mascota-perfil',
  standalone: true,
  imports: [
    NgIf, NgFor,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonGrid, IonRow, IonCol,
    IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText,
    IonCard, IonCardContent
  ],
  templateUrl: './perfil-mascota.component.html',
  styleUrls: ['./perfil-mascota.component.scss']
})
export class MascotaPerfilComponent implements OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fs = inject(FirestoreService);
  private destroy$ = new Subject<void>();
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);
  private security = inject(SecurityService);

  veterinariasFavoritas: VeterinariaFavorita[] = [];
  private auth = inject(AuthenticationService);

  mascota = signal<Mascota | null>(null);
  loading = signal(true);
  esRefugio = signal(false);
  actualizandoEstado = false;

  constructor() {
    addIcons({ alertCircleOutline, checkmarkCircleOutline });

    // 1) intenta tomar desde router state (rápido)
    const st = this.router.getCurrentNavigation()?.extras?.state as { mascota?: Mascota } | undefined;
    if (st?.mascota) {
      this.mascota.set(st.mascota);
      this.loading.set(false);
    }

    // 2) lee por :id (fuente de verdad) — es un stream vivo de Firestore, hay
    // que cortarlo al salir de la pantalla o queda escuchando para siempre.
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fs.getPetById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((doc) => {
        if (doc) this.mascota.set(doc);
        this.loading.set(false);
      });

    // Solo un refugio puede transferir la mascota a un nuevo dueño.
    const uid = this.auth.getCurrentUser()?.uid;
    if (uid) {
      this.fs.getDocument(`usuarios/${uid}`).then(perfil => {
        this.esRefugio.set(perfil?.rol === 'refugio');
      });
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get avatar(): string {
    return this.mascota()?.fotoUrl || 'assets/img/logo_ashbis.jpeg';
  }

  // Acciones (placeholders)
editarPerfil() {
  const id = this.mascota()?.id;
  if (id) {
    this.router.navigate(['/tabs/mascota-editar', id, 'editar']);
  }
}
  verHistorial() {
    const id = this.mascota()?.id;
    if (id) {
      // Va directo al carnet (mismo link que el QR), no a una página que
      // primero muestra un QR para escanear.
      this.router.navigate(['/carnet', id]);
    }
  }
  verQR() { this.router.navigate(['/tabs/mascota-qr',]) }

  get estaPerdida(): boolean {
    return this.mascota()?.estado === 'perdida';
  }

  async toggleEstadoPerdida(): Promise<void> {
    if (this.estaPerdida) {
      // Marcar como encontrada no expone nada, se hace directo.
      await this.actualizarEstado('normal', 'Marcada como encontrada. Ya no se muestra tu contacto en la ficha.');
      return;
    }

    // Activar el reporte de pérdida expone tu contacto en la ficha pública
    // del QR, así que se pide confirmación antes.
    const alert = await this.alertCtrl.create({
      header: 'Reportar como perdida',
      message: 'A partir de ahora, quien escanee el QR de "mascota perdida" va a poder ver tu nombre y teléfono de contacto para ayudarte a encontrarla. Podés desactivarlo cuando quieras.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Reportar perdida',
          handler: () => this.actualizarEstado('perdida', 'Mascota reportada como perdida. Tu contacto ya es visible en la ficha del QR.')
        }
      ]
    });
    await alert.present();
  }

  private async actualizarEstado(estado: 'normal' | 'perdida', mensajeExito: string): Promise<void> {
    const id = this.mascota()?.id;
    if (!id || this.actualizandoEstado) return;
    this.actualizandoEstado = true;
    try {
      await this.fs.updatePet(id, { estado });
      await this.presentToast(mensajeExito, 'success');
    } catch {
      await this.presentToast('No se pudo actualizar el estado. Intenta nuevamente.', 'danger');
    } finally {
      this.actualizandoEstado = false;
    }
  }

  async transferirMascota(): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;

    const tipoAlert = await this.alertCtrl.create({
      header: `Transferir a ${m.nombre}`,
      message: 'Adopción: se entrega la mascota por completo, con todo su historial. Hogar temporal: acceso compartido, la mascota sigue siendo tuya.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Hogar temporal', handler: () => this.pedirDatosTransferencia(m, 'hogar_temporal') },
        { text: 'Adopción completa', handler: () => this.pedirDatosTransferencia(m, 'adopcion') },
      ]
    });
    await tipoAlert.present();
  }

  private async pedirDatosTransferencia(
    m: Mascota,
    tipo: 'adopcion' | 'hogar_temporal'
  ): Promise<void> {
    const esAdopcion = tipo === 'adopcion';
    const alert = await this.alertCtrl.create({
      header: esAdopcion ? `Adopción de ${m.nombre}` : `Hogar temporal para ${m.nombre}`,
      message: esAdopcion
        ? 'El nuevo dueño recibirá una solicitud en su perfil. La mascota (con todo su historial) solo pasa a su cuenta cuando la acepte.'
        : 'La persona recibirá una solicitud en su perfil. Al aceptar, comparte acceso al perfil e historial de la mascota, pero vos seguís como dueño/a.',
      inputs: [
        { name: 'email', type: 'email', placeholder: `Email de ${esAdopcion ? 'quien la adopta' : 'quien la va a cuidar'}` },
        { name: 'mensaje', type: 'textarea', placeholder: 'Mensaje (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar',
          handler: async (data) => {
            const email = this.security.sanitizeText(data.email || '', 200);
            if (!this.security.isValidEmail(email)) {
              await this.presentToast('Ingresa un email válido.', 'danger');
              return false;
            }
            try {
              const uid = this.auth.getCurrentUser()?.uid;
              const perfil = uid ? await this.fs.getDocument(`usuarios/${uid}`) : null;
              const deNombre = perfil?.nombreRefugio?.trim()
                || `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
                || 'Un refugio';
              await this.fs.crearTransferencia(
                tipo,
                m.id!,
                m.nombre,
                m.uidUsuario,
                deNombre,
                email,
                data.mensaje ? this.security.sanitizeText(data.mensaje, 500) : undefined
              );
              await this.presentToast(
                esAdopcion ? 'Solicitud de adopción enviada.' : 'Solicitud de hogar temporal enviada.',
                'success'
              );
              return true;
            } catch {
              await this.presentToast('No se pudo enviar la solicitud. Intenta nuevamente.', 'danger');
              return false;
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
