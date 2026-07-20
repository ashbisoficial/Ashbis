import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf, DatePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
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
  AlertController,
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
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonButton,
  IonIcon,
  IonTextarea,
  ToastController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  medicalOutline,
  clipboardOutline,
  eyedropOutline,
  pawOutline,
  mapOutline,
  documentTextOutline,
  keyOutline,
  copyOutline,
  personRemoveOutline,
  sendOutline
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
    FormsModule,

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
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,

    IonButton,
    IonIcon,
    IonTextarea
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

  mascotaId = '';
  private miUid = '';

  cargando = true;

  constructor() {
    addIcons({
      medicalOutline,
      clipboardOutline,
      eyedropOutline,
      pawOutline,
      mapOutline,
      documentTextOutline,
      keyOutline,
      copyOutline,
      personRemoveOutline,
      sendOutline
    });
  }

  segmentoActual: 'vacunas' | 'examenes' | 'medicamentos' | 'veterinarias' | 'historial' = 'vacunas';

  mascota: Mascota | null = null;

  vacunas: Vacuna[] = [];
  examenes: Examen[] = [];
  medicamentos: Medicamento[] = [];
  veterinariasFavoritas: VeterinariaFavorita[] = [];

  /** true si soy el veterinario que está viendo la ficha (cuenta rol
   *  'veterinario'): oculta el segmento "Veterinarias" (irrelevante para
   *  él) y abre directo en "Historial médico". */
  soyVeterinario = false;
  /** true si soy dueño/equipo de esta mascota: solo esa cuenta puede generar
   *  el PIN y ver/revocar accesos otorgados a veterinarios. */
  puedoCompartirConVeterinario = false;

  entradasHistorial: Models.HistorialMedico.Entrada[] = [];
  accesosVeterinario: Models.Mascotas.AccesoVeterinario[] = [];
  nuevaNota = '';
  enviandoNota = false;

  ngOnInit() {

    this.cargarVeterinariasFavoritas();
    this.cargarMiRol();

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
      this.puedoCompartirConVeterinario = !!mascota && mascota.uidUsuario === this.miUid;
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

    this.firestoreService.getHistorialMedico(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.entradasHistorial = data);

    this.firestoreService.getAccesosVeterinario(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.accesosVeterinario = data);
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

  private cargarMiRol() {
    const uid = this.auth.getCurrentUser()?.uid;
    this.miUid = uid ?? '';
    if (!uid) return;
    this.firestoreService.getDocument(`usuarios/${uid}`).then(perfil => {
      this.soyVeterinario = perfil?.rol === 'veterinario';
      if (this.soyVeterinario) this.segmentoActual = 'historial';
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

  // ── Historial médico (notas) ────────────────────────────────────────────

  /** createdAt es un serverTimestamp: en la nota recién enviada puede
   *  llegar null un instante hasta que el servidor lo resuelve. */
  fechaNota(n: Models.HistorialMedico.Entrada): string {
    const ts = n.createdAt?.toDate?.();
    if (!ts) return 'enviando…';
    return ts.toLocaleString([], {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  async agregarNota(): Promise<void> {
    const texto = this.nuevaNota.trim();
    if (!texto || this.enviandoNota) return;
    this.enviandoNota = true;
    try {
      await this.firestoreService.agregarEntradaHistorial(this.mascotaId, texto);
      this.nuevaNota = '';
    } catch {
      await this.mostrarToast('No se pudo guardar la nota. Intenta nuevamente.', 'danger');
    } finally {
      this.enviandoNota = false;
    }
  }

  // ── Compartir con veterinario (PIN) ─────────────────────────────────────

  async generarPin(): Promise<void> {
    if (!this.puedoCompartirConVeterinario) return;
    const alert = await this.alertCtrl.create({
      header: this.mascota?.pinHistorial ? 'Regenerar PIN' : 'Generar PIN',
      message: this.mascota?.pinHistorial
        ? 'El PIN anterior dejará de servir para nuevos veterinarios (los que ya tienen acceso lo conservan).'
        : 'Compártelo junto con el ID de la mascota con tu veterinario para que pueda ver y agregar notas al historial médico.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: this.mascota?.pinHistorial ? 'Regenerar' : 'Generar',
          handler: async () => {
            try {
              await this.firestoreService.regenerarPinMascota(this.mascotaId);
            } catch {
              await this.mostrarToast('No se pudo generar el PIN. Intenta nuevamente.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async copiarId(): Promise<void> {
    await navigator.clipboard?.writeText(this.mascotaId);
    await this.mostrarToast('ID de la mascota copiado.', 'success');
  }

  async copiarPin(): Promise<void> {
    if (!this.mascota?.pinHistorial) return;
    await navigator.clipboard?.writeText(this.mascota.pinHistorial);
    await this.mostrarToast('PIN copiado.', 'success');
  }

  async revocarAcceso(acceso: Models.Mascotas.AccesoVeterinario): Promise<void> {
    if (!this.puedoCompartirConVeterinario) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar acceso',
      message: `¿Quitarle a "${acceso.vetNombre}" el acceso al historial médico?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.revocarAccesoVeterinario(this.mascotaId, acceso.vetUid);
            } catch {
              await this.mostrarToast('No se pudo quitar el acceso. Intenta nuevamente.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }

}