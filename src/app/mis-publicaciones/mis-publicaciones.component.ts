import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonTextarea,
  IonSelect,
  IonSelectOption,
  IonButton,
  IonIcon,
  IonBadge,
  IonSpinner,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, trashOutline, pauseOutline, playOutline } from 'ionicons/icons';
import { Subject, switchMap, takeUntil } from 'rxjs';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';

@Component({
  selector: 'app-mis-publicaciones',
  standalone: true,
  templateUrl: './mis-publicaciones.component.html',
  styleUrls: ['./mis-publicaciones.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonIcon,
    IonBadge,
    IonSpinner
  ]
})
export class MisPublicacionesComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly security = inject(SecurityService);
  private readonly fb = inject(FormBuilder);

  private uid: string | null = null;
  private nombreRefugio = 'Refugio';

  cargando = true;
  guardando = false;
  mostrarForm = false;

  publicaciones: Models.Publicaciones.Publicacion[] = [];
  misMascotas: Mascota[] = [];

  readonly tipos: { value: Models.Publicaciones.TipoPublicacion; label: string }[] = [
    { value: 'adopcion', label: '🐾 Adopción' },
    { value: 'recoleccion', label: '📋 Recolección' },
    { value: 'donacion', label: '💛 Donación' },
    { value: 'otro', label: '📌 Otro' },
  ];

  form = this.fb.group({
    tipo: ['adopcion' as Models.Publicaciones.TipoPublicacion, Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    mascotaId: [''],
  });

  constructor() {
    addIcons({ addOutline, closeOutline, trashOutline, pauseOutline, playOutline });

    this.auth.authState$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(user => {
          this.uid = user?.uid ?? null;
          if (!user) return [];
          this.firestoreService.getDocument(`usuarios/${user.uid}`).then(perfil => {
            this.nombreRefugio = perfil?.nombreRefugio?.trim()
              || `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim()
              || 'Refugio';
          });
          this.firestoreService.getUserPets(user.uid)
            .pipe(takeUntil(this.destroy$))
            .subscribe(pets => this.misMascotas = pets);
          return this.firestoreService.getPublicacionesByUsuario(user.uid);
        })
      )
      .subscribe(pubs => {
        this.publicaciones = pubs;
        this.cargando = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  toggleForm(): void {
    this.mostrarForm = !this.mostrarForm;
    if (!this.mostrarForm) this.form.reset({ tipo: 'adopcion', titulo: '', descripcion: '', mascotaId: '' });
  }

  async publicar(): Promise<void> {
    if (this.form.invalid || !this.uid) {
      this.form.markAllAsTouched();
      return;
    }

    this.guardando = true;
    try {
      const data = this.form.value;
      const mascota = this.misMascotas.find(m => m.id === data.mascotaId);

      await this.firestoreService.crearPublicacion({
        uidAutor: this.uid,
        nombreAutor: this.nombreRefugio,
        tipo: data.tipo!,
        titulo: this.security.sanitizeText(data.titulo!, 120),
        descripcion: this.security.sanitizeText(data.descripcion!, 1000),
        ...(data.mascotaId ? { mascotaId: data.mascotaId } : {}),
        ...(mascota?.fotoUrl ? { fotoUrl: mascota.fotoUrl } : {}),
      });

      this.toggleForm();
      await this.presentToast('Publicación creada. Ya está visible en el feed de adopciones.', 'success');
    } catch {
      await this.presentToast('No se pudo crear la publicación. Intenta nuevamente.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async toggleActiva(pub: Models.Publicaciones.Publicacion): Promise<void> {
    if (!pub.id) return;
    try {
      await this.firestoreService.actualizarPublicacion(pub.id, { activa: !pub.activa });
    } catch {
      await this.presentToast('No se pudo actualizar la publicación.', 'danger');
    }
  }

  async eliminar(pub: Models.Publicaciones.Publicacion): Promise<void> {
    if (!pub.id) return;
    const alert = await this.alertCtrl.create({
      header: 'Eliminar publicación',
      message: `¿Eliminar "${pub.titulo}"? Esta acción no se puede deshacer.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.eliminarPublicacion(pub.id!);
            } catch {
              await this.presentToast('No se pudo eliminar la publicación.', 'danger');
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
