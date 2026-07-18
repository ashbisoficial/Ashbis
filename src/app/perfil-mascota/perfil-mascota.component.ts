import { Component, inject, signal, OnDestroy } from '@angular/core';
import { NgIf, NgFor, TitleCasePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonGrid, IonRow, IonCol,
  IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText,
  AlertController, ToastController
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
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
    IonItem, IonLabel, IonButton, IonAvatar, IonList, IonSkeletonText
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

  constructor() {
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
      // La ruta correcta al dashboard de tu equipo
      this.router.navigate(['/tabs/mascota-detalle', id]);
    }
  }
  verQR() { this.router.navigate(['/tabs/mascota-qr',]) }

  async transferirMascota(): Promise<void> {
    const m = this.mascota();
    if (!m?.id) return;

    const alert = await this.alertCtrl.create({
      header: `Transferir a ${m.nombre}`,
      message: 'El nuevo dueño recibirá una solicitud en su perfil. La mascota solo pasa a su cuenta cuando él la acepta.',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email del nuevo dueño' },
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
                m.id!,
                m.nombre,
                deNombre,
                email,
                data.mensaje ? this.security.sanitizeText(data.mensaje, 500) : undefined
              );
              await this.presentToast('Solicitud de transferencia enviada.', 'success');
              return true;
            } catch {
              await this.presentToast('No se pudo enviar la transferencia. Intenta nuevamente.', 'danger');
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
