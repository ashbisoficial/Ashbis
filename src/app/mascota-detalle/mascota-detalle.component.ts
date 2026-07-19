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
  IonIcon
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  medicalOutline,
  clipboardOutline,
  eyedropOutline,
  pawOutline,
  mapOutline
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

  private mascotaId = '';

  cargando = true;

  constructor() {
    addIcons({
      medicalOutline,
      clipboardOutline,
      eyedropOutline,
      pawOutline,
      mapOutline
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

}