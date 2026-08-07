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
  IonCheckbox,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, closeOutline, trashOutline, pauseOutline, playOutline, imageOutline } from 'ionicons/icons';
import { Subject, catchError, of, switchMap, takeUntil } from 'rxjs';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';
import { PreferenciasService } from '../services/preferencias.service';

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
    IonSpinner,
    IonCheckbox
  ]
})
export class MisPublicacionesComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly security = inject(SecurityService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly fb = inject(FormBuilder);

  private uid: string | null = null;
  /** Nombre a mostrar como autor de la publicación: nombre del refugio si la
   *  cuenta es de ese rol, si no el nombre de pila (cualquier cuenta puede
   *  publicar en adopción una mascota propia, no solo refugios — ver
   *  firestore.rules match /publicaciones). Vacío hasta que carga el
   *  perfil; publicar() espera a que tenga un valor real en vez de guardar
   *  un texto genérico. */
  private nombreAutor = '';
  private miRegion?: string;
  private miComuna?: string;

  cargando = true;
  errorCarga = false;
  guardando = false;
  mostrarForm = false;

  publicaciones: Models.Publicaciones.Publicacion[] = [];
  misMascotas: Mascota[] = [];

  fotoFile: File | null = null;
  fotoPreview: string | null = null;

  readonly tipos: { value: Models.Publicaciones.TipoPublicacion; label: string }[] = [
    { value: 'adopcion', label: '🐾 Adopción' },
    { value: 'recoleccion', label: '📋 Recolección' },
    { value: 'donacion', label: '💛 Donación' },
    { value: 'otro', label: '📌 Otro' },
  ];

  private readonly tipoLabels: Record<string, string> = {
    adopcion: 'Adopción',
    recoleccion: 'Recolección',
    donacion: 'Donación',
    otro: 'Otro',
  };

  tipoLabel(tipo: string): string {
    return this.tipoLabels[tipo] ?? tipo;
  }

  form = this.fb.group({
    tipo: ['adopcion' as Models.Publicaciones.TipoPublicacion, Validators.required],
    titulo: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(120)]],
    descripcion: ['', [Validators.required, Validators.minLength(10), Validators.maxLength(1000)]],
    mascotaId: [''],
    aceptaVeracidad: [false, Validators.requiredTrue],
  });

  constructor() {
    addIcons({ addOutline, closeOutline, trashOutline, pauseOutline, playOutline, imageOutline });

    this.auth.authState$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(user => {
          this.uid = user?.uid ?? null;
          if (!user) return [];
          this.firestoreService.getDocument(`usuarios/${user.uid}`).then(perfil => {
            // Solo el primer nombre (o el nombre del refugio): nunca el
            // apellido completo ni la dirección, para no exponer datos
            // personales en un feed público.
            this.nombreAutor = perfil?.nombreRefugio?.trim()
              || perfil?.nombre?.trim()
              || '';
            this.miRegion = perfil?.region;
            this.miComuna = perfil?.comuna;
          });
          this.firestoreService.getUserPets(user.uid)
            .pipe(takeUntil(this.destroy$))
            .subscribe(pets => this.misMascotas = pets);
          return this.firestoreService.getPublicacionesByUsuario(user.uid).pipe(
            catchError(err => {
              console.error('getPublicacionesByUsuario falló:', err);
              this.errorCarga = true;
              return of<Models.Publicaciones.Publicacion[]>([]);
            })
          );
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
    if (!this.mostrarForm) {
      this.form.reset({ tipo: 'adopcion', titulo: '', descripcion: '', mascotaId: '', aceptaVeracidad: false });
      this.fotoFile = null;
      this.fotoPreview = null;
    }
  }

  /** Abre el selector de archivo solo si la cámara/galería está habilitada
   *  en Configuración → Permisos (preferencia propia de Ashbis, no el
   *  permiso real del navegador). */
  abrirSelectorArchivo(input: HTMLInputElement): void {
    if (!this.preferencias.camaraHabilitada) {
      this.presentToast('Activa la cámara en Configuración → Permisos para subir fotos.', 'danger');
      return;
    }
    input.click();
  }

  onFotoSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxMb: 8,
    });
    if (error) {
      this.presentToast(error, 'danger');
      return;
    }

    this.fotoFile = file;
    const reader = new FileReader();
    reader.onload = () => this.fotoPreview = reader.result as string;
    reader.readAsDataURL(file);
  }

  quitarFoto(): void {
    this.fotoFile = null;
    this.fotoPreview = null;
  }

  async publicar(): Promise<void> {
    if (this.form.invalid || !this.uid) {
      this.form.markAllAsTouched();
      return;
    }

    // El perfil (nombre a mostrar como autor) carga async al entrar a la
    // pantalla — si todavía no llegó, mejor avisar que dejar guardar la
    // publicación sin nombre real de autor.
    if (!this.nombreAutor) {
      const toast = await this.toastCtrl.create({
        message: 'Tu perfil todavía está cargando. Intenta de nuevo en un momento.',
        duration: 2500,
        color: 'warning',
      });
      await toast.present();
      return;
    }

    this.guardando = true;
    try {
      const data = this.form.value;
      const mascota = this.misMascotas.find(m => m.id === data.mascotaId);

      // La foto que elige la persona pisa a la de la mascota vinculada;
      // si no eligió ninguna, se usa la de la mascota (si hay).
      const fotoUrl = this.fotoFile
        ? await this.firestoreService.uploadPublicacionPhoto(this.uid, this.fotoFile)
        : mascota?.fotoUrl;

      await this.firestoreService.crearPublicacion({
        uidAutor: this.uid,
        nombreAutor: this.nombreAutor,
        ...(this.miRegion ? { region: this.miRegion } : {}),
        ...(this.miComuna ? { comuna: this.miComuna } : {}),
        tipo: data.tipo!,
        titulo: this.security.sanitizeText(data.titulo!, 120),
        descripcion: this.security.sanitizeText(data.descripcion!, 1000),
        aceptaVeracidad: data.aceptaVeracidad === true,
        ...(data.mascotaId ? { mascotaId: data.mascotaId } : {}),
        ...(fotoUrl ? { fotoUrl } : {}),
        // Info pública de la mascota vinculada: ver nota en
        // perfil-mascota.component.ts (publicarEnAdopcion).
        ...(mascota?.especie ? { especie: mascota.especie } : {}),
        ...(mascota?.raza ? { raza: mascota.raza } : {}),
        ...(mascota?.sexo ? { sexo: mascota.sexo } : {}),
        ...(mascota?.edad != null ? { edad: mascota.edad } : {}),
        ...(mascota?.color ? { color: mascota.color } : {}),
        ...(mascota?.castrado ? { castrado: mascota.castrado } : {}),
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
