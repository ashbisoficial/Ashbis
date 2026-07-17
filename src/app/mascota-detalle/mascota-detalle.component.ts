import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { of, Subject, switchMap, takeUntil } from 'rxjs';

import { 
  FirestoreService, 
  Mascota, 
  Vacuna, 
  Examen, 
  Medicamento,
  VeterinariaFavorita 
} from '../../app/firebase/firestore';

import { Models } from '../../app/models/models';

import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonList,
  IonItem,
  IonNote,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonButton,
  IonIcon,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  medicalOutline,
  clipboardOutline,
  eyedropOutline,
  pawOutline,
  mapOutline,
  alertCircleOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

import { AuthenticationService } from 'src/app/firebase/authentication';
import { Router } from '@angular/router';

@Component({
  selector: 'app-mascota-detalle',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
    DatePipe,

    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,

    IonSegment,
    IonSegmentButton,

    IonLabel,
    IonList,
    IonItem,
    IonNote,
    IonCard,
    IonCardContent,
    IonSpinner,

    IonButton,
    IonIcon
  ],
  providers: [DatePipe],
  templateUrl: './mascota-detalle.component.html',
  styleUrls: ['./mascota-detalle.component.scss'],
})
export class MascotaDetalleComponent implements OnInit, OnDestroy {
  
  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);
  private firestoreService = inject(FirestoreService);
  private auth = inject(AuthenticationService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);
  private toastCtrl = inject(ToastController);

  private mascotaId = '';

  cargando = true;
  actualizandoEstado = false;

  constructor() {
    addIcons({
      medicalOutline,
      clipboardOutline,
      eyedropOutline,
      pawOutline,
      mapOutline,
      alertCircleOutline,
      checkmarkCircleOutline
    });
  }

  segmentoActual: 'vacunas' | 'examenes' | 'medicamentos' | 'veterinarias' = 'vacunas';

  mascota: Mascota | null = null;

  vacunas: Vacuna[] = [];
  examenes: Examen[] = [];
  medicamentos: Medicamento[] = [];
  veterinariasFavoritas: VeterinariaFavorita[] = [];

  ngOnInit() {

    this.cargarVeterinariasFavoritas();

    this.route.paramMap.pipe(
      takeUntil(this.destroy$),
      switchMap(params => {
        const id = params.get('id');

        if (!id) {
          throw new Error('No se proveyó ID de mascota');
        }

        this.mascotaId = id;

        return this.firestoreService.getDocumentChanges<Mascota>(
          `${Models.Mascotas.PathMascotas}/${this.mascotaId}`
        );
      })
    ).subscribe(mascota => {
      this.mascota = mascota;
      this.cargando = false;
      this.cargarSubColecciones();
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarSubColecciones() {

    const basePath = `${Models.Mascotas.PathMascotas}/${this.mascotaId}`;

    this.firestoreService.getCollectionChanges<Vacuna>(`${basePath}/vacunas`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.vacunas = data);

    this.firestoreService.getCollectionChanges<Examen>(`${basePath}/examenes`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.examenes = data);

    this.firestoreService.getCollectionChanges<Medicamento>(`${basePath}/medicamentos`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.medicamentos = data);
  }

  segmentoCambiado(evento: any) {
    this.segmentoActual = evento.detail.value;
  }

  private cargarVeterinariasFavoritas() {
    this.auth.authState$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (!user) return of<VeterinariaFavorita[]>([]);
        return this.firestoreService.getVeterinariasFavoritasByUsuario(user.uid);
      })
    ).subscribe(vets => {
      this.veterinariasFavoritas = vets;
    });
  }

  abrirEnMapa(vet: VeterinariaFavorita) {
    this.router.navigate(['/home'], {
      queryParams: {
        lat: vet.lat,
        lng: vet.lng,
        nombre: vet.nombre
      }
    });
  }

  get estaPerdida(): boolean {
    return this.mascota?.estado === 'perdida';
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
    if (!this.mascotaId || this.actualizandoEstado) return;
    this.actualizandoEstado = true;
    try {
      await this.firestoreService.updatePet(this.mascotaId, { estado });
      const toast = await this.toastCtrl.create({
        message: mensajeExito,
        duration: 3000,
        color: estado === 'perdida' ? 'warning' : 'success'
      });
      await toast.present();
    } catch {
      const toast = await this.toastCtrl.create({
        message: 'No se pudo actualizar el estado. Intenta nuevamente.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.actualizandoEstado = false;
    }
  }
}