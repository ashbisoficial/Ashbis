import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, NgIf } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { of, Subject, switchMap, takeUntil } from 'rxjs';

import {
  FirestoreService,
  Mascota,
  VeterinariaFavorita,
  Vacuna,
  Examen,
  Medicamento
} from '../../app/firebase/firestore';
import { Subscription } from 'rxjs';

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
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  IonButton,
  IonIcon,
  IonTextarea,
  IonAvatar,
  IonNote,
  ToastController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import {
  pawOutline,
  mapOutline,
  documentTextOutline,
  keyOutline,
  copyOutline,
  personRemoveOutline,
  sendOutline,
  timeOutline,
  alertCircleOutline
} from 'ionicons/icons';

import { AuthenticationService } from 'src/app/firebase/authentication';
import { Router } from '@angular/router';
import { RefugioContextService } from 'src/app/services/refugio-context.service';
import { take } from 'rxjs';

@Component({
  selector: 'app-mascota-detalle',
  standalone: true,
  imports: [
    CommonModule,
    NgIf,
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
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,

    IonButton,
    IonIcon,
    IonTextarea,
    IonAvatar,
    IonNote
  ],
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
  private refugioCtx = inject(RefugioContextService);

  mascotaId = '';
  private miUid = '';

  cargando = true;

  constructor() {
    addIcons({
      pawOutline,
      mapOutline,
      documentTextOutline,
      keyOutline,
      copyOutline,
      personRemoveOutline,
      sendOutline,
      timeOutline,
      alertCircleOutline
    });
  }

  segmentoActual: 'veterinarias' | 'historial' | 'resumen' = 'veterinarias';

  mascota: Mascota | null = null;

  veterinariasFavoritas: VeterinariaFavorita[] = [];

  /** true si soy el veterinario que está viendo la ficha (cuenta rol
   *  'veterinario'): oculta el segmento "Veterinarias" (irrelevante para
   *  él), muestra "Resumen" (datos clínicos, solo lectura) y abre directo
   *  en "Historial médico". */
  soyVeterinario = false;
  /** true recién cuando ya se supo si soyVeterinario o no — antes de eso no
   *  se muestra el segmento, para no mostrar un instante "Veterinarias"
   *  (segmento por defecto) y que salte a "Historial" apenas resuelve. */
  rolListo = false;

  vacunas: Vacuna[] = [];
  medicamentos: Medicamento[] = [];
  examenes: Examen[] = [];
  private subVacunas?: Subscription;
  private subMedicamentos?: Subscription;
  private subExamenes?: Subscription;
  /** true si soy dueño/equipo de esta mascota: solo esa cuenta puede generar
   *  el PIN y ver/revocar accesos otorgados a veterinarios. */
  puedoCompartirConVeterinario = false;
  /** true si soy dueño O parte del equipo del refugio dueño de esta mascota
   *  (a diferencia de puedoCompartirConVeterinario, que es solo dueño):
   *  gestionar hogar temporal sigue el mismo criterio que editar la
   *  mascota, no el de veterinarias/publicaciones/equipo. */
  puedoGestionarHogarTemporal = false;

  entradasHistorial: Models.HistorialMedico.Entrada[] = [];
  accesosVeterinario: Models.Mascotas.AccesoVeterinario[] = [];
  colaboradoresHogarTemporal: Models.Mascotas.ColaboradorMascota[] = [];
  nuevaNota = '';
  enviandoNota = false;

  ngOnInit() {

    this.cargarVeterinariasFavoritas();
    this.cargarMiRol();

    // Permite llegar directo a la pestaña "Historial" (donde vive el PIN
    // para veterinario) desde un link externo, sin depender de que el
    // usuario la seleccione a mano.
    const segmento = this.route.snapshot.queryParamMap.get('segmento');
    if (segmento === 'historial') this.segmentoActual = 'historial';

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
      this.cargarDatosClinicosSiVet();
      this.calcularPuedoGestionarHogarTemporal(mascota);
    });
  }

  private calcularPuedoGestionarHogarTemporal(mascota: Mascota | undefined) {
    if (!mascota) { this.puedoGestionarHogarTemporal = false; return; }
    this.refugioCtx.contexto$()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(ctx => {
        // Mismo caso que en publicacion-detalle: ctx.todos no incluye el uid
        // propio si la cuenta no es de rol 'refugio', pero cualquier cuenta
        // puede ser dueña directa de una mascota en hogar temporal.
        this.puedoGestionarHogarTemporal = mascota.uidUsuario === ctx.miUid || ctx.todos.includes(mascota.uidUsuario);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subVacunas?.unsubscribe();
    this.subMedicamentos?.unsubscribe();
    this.subExamenes?.unsubscribe();
  }

  cargarSubColecciones() {

    this.firestoreService.getHistorialMedico(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.entradasHistorial = data);

    this.firestoreService.getAccesosVeterinario(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.accesosVeterinario = data);

    this.firestoreService.getColaboradoresMascota(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.colaboradoresHogarTemporal = data);
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
    if (!uid) { this.rolListo = true; return; }
    this.firestoreService.getDocument(`usuarios/${uid}`).then(perfil => {
      this.soyVeterinario = perfil?.rol === 'veterinario';
      if (this.soyVeterinario) this.segmentoActual = 'historial';
      this.rolListo = true;
      this.cargarDatosClinicosSiVet();
    });
  }

  /** Vacunas/medicamentos/exámenes registrados por el dueño (mascota-editar):
   *  antes un veterinario con acceso por PIN solo veía el historial de
   *  notas de texto libre, sin poder ver nada de esto pese a que las
   *  reglas de Firestore ya se lo permiten (puedeVerHistorialMedico). Solo
   *  se cargan para el veterinario — el dueño ya las administra desde
   *  "Editar mascota", cargarlas de nuevo acá sería una lectura de más. */
  private cargarDatosClinicosSiVet(): void {
    if (!this.soyVeterinario || !this.mascotaId) return;

    this.subVacunas?.unsubscribe();
    this.subVacunas = this.firestoreService.getVacunasByMascota(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.vacunas = data);

    this.subMedicamentos?.unsubscribe();
    this.subMedicamentos = this.firestoreService.getMedicamentosByMascota(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.medicamentos = data);

    this.subExamenes?.unsubscribe();
    this.subExamenes = this.firestoreService.getExamenesByMascota(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.examenes = data);
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
        : 'Compártelo junto con el ID de la mascota con tu veterinario para que pueda ver el historial médico. Solo funciona con cuentas de veterinario ya verificadas por Ashbis, y vence a los 90 días (después hay que generar uno nuevo).',
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

  // ── Hogar temporal ───────────────────────────────────────────────────────

  async quitarHogarTemporal(colab: Models.Mascotas.ColaboradorMascota): Promise<void> {
    if (!this.puedoGestionarHogarTemporal) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar hogar temporal',
      message: `¿Quitarle a "${colab.nombre}" el acceso a ${this.mascota?.nombre ?? 'esta mascota'}? Deja de poder ver o actualizar su perfil.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.quitarColaboradorMascota(this.mascotaId, colab.uid);
              await this.mostrarToast('Se quitó el hogar temporal.', 'success');
            } catch {
              await this.mostrarToast('No se pudo quitar. Intenta nuevamente.', 'danger');
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