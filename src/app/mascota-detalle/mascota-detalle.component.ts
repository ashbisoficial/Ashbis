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
  Medicamento,
  DocumentoMascota
} from '../../app/firebase/firestore';
import { Subscription } from 'rxjs';

import { Models } from '../../app/models/models';
import { OrdenPdfService } from 'src/app/services/orden-pdf.service';

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
  IonInput,
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
  peopleOutline,
  sendOutline,
  timeOutline,
  alertCircleOutline,
  createOutline,
  clipboardOutline,
  medkitOutline,
  shieldCheckmarkOutline,
  flaskOutline,
  cutOutline
} from 'ionicons/icons';

import { AuthenticationService } from 'src/app/firebase/authentication';
import { Router } from '@angular/router';
import { RefugioContextService } from 'src/app/services/refugio-context.service';
import { take } from 'rxjs';

interface ConfigTipoOrden {
  label: string;
  icono: string;
  color: string;
  motivoLabel: string;
  motivoPlaceholder: string;
  diagnosticoLabel: string;
  diagnosticoPlaceholder: string;
  tratamientoLabel: string;
  tratamientoPlaceholder: string;
  textoLabel: string;
}

/** Etiquetas de los mismos 4 campos de siempre (motivo/diagnóstico/
 *  tratamiento/texto — ver Models.HistorialMedico.Entrada), reformuladas
 *  según el tipo de orden para que se lea como un registro clínico real en
 *  vez de una nota genérica. No agrega campos nuevos al modelo de datos. */
const CONFIG_TIPO_ORDEN: Record<Models.HistorialMedico.TipoEntrada, ConfigTipoOrden> = {
  consulta: {
    label: 'Consulta general', icono: 'clipboard-outline', color: 'medium',
    motivoLabel: 'Motivo de consulta', motivoPlaceholder: 'Ej: control anual, vómitos hace 2 días',
    diagnosticoLabel: 'Diagnóstico / impresión clínica', diagnosticoPlaceholder: '',
    tratamientoLabel: 'Plan indicado', tratamientoPlaceholder: 'Procedimientos, exámenes solicitados, medicación...',
    textoLabel: 'Otras observaciones',
  },
  receta: {
    label: 'Receta médica', icono: 'medkit-outline', color: 'tertiary',
    motivoLabel: 'Diagnóstico / motivo del tratamiento', motivoPlaceholder: '',
    diagnosticoLabel: 'Medicamento(s), dosis y vía', diagnosticoPlaceholder: 'Ej: Amoxicilina 250mg, VO, cada 12h x 7 días',
    tratamientoLabel: 'Duración e indicaciones de administración', tratamientoPlaceholder: '',
    textoLabel: 'Indicaciones al propietario / signos de alarma',
  },
  vacunacion: {
    label: 'Vacunación / desparasitación', icono: 'shield-checkmark-outline', color: 'success',
    motivoLabel: 'Vacuna / producto aplicado', motivoPlaceholder: '',
    diagnosticoLabel: 'Próxima dosis / refuerzo', diagnosticoPlaceholder: '',
    tratamientoLabel: 'Vía de aplicación y lote', tratamientoPlaceholder: '',
    textoLabel: 'Observaciones',
  },
  examen: {
    label: 'Examen / imagenología', icono: 'flask-outline', color: 'secondary',
    motivoLabel: 'Motivo clínico del estudio', motivoPlaceholder: '',
    diagnosticoLabel: 'Estudio(s) solicitado(s)', diagnosticoPlaceholder: 'Ej: hemograma, radiografía de tórax',
    tratamientoLabel: 'Preparación previa', tratamientoPlaceholder: 'Ayuno, sedación...',
    textoLabel: 'Resultado / hallazgos',
  },
  cirugia: {
    label: 'Cirugía', icono: 'cut-outline', color: 'danger',
    motivoLabel: 'Procedimiento propuesto', motivoPlaceholder: '',
    diagnosticoLabel: 'Evaluación prequirúrgica', diagnosticoPlaceholder: '',
    tratamientoLabel: 'Protocolo anestésico', tratamientoPlaceholder: '',
    textoLabel: 'Indicaciones postoperatorias',
  },
  otro: {
    label: 'Otro', icono: 'document-text-outline', color: 'medium',
    motivoLabel: 'Motivo', motivoPlaceholder: '',
    diagnosticoLabel: 'Diagnóstico', diagnosticoPlaceholder: '',
    tratamientoLabel: 'Tratamiento', tratamientoPlaceholder: '',
    textoLabel: 'Observaciones',
  },
};

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
    IonInput,
    IonTextarea,
    IonAvatar,
    IonNote,
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
  private ordenPdfSvc = inject(OrdenPdfService);

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
      peopleOutline,
      sendOutline,
      timeOutline,
      alertCircleOutline,
      createOutline,
      clipboardOutline,
      medkitOutline,
      shieldCheckmarkOutline,
      flaskOutline,
      cutOutline
    });
  }

  readonly tiposOrden: { valor: Models.HistorialMedico.TipoEntrada; config: ConfigTipoOrden }[] =
    (Object.entries(CONFIG_TIPO_ORDEN) as [Models.HistorialMedico.TipoEntrada, ConfigTipoOrden][])
      .map(([valor, config]) => ({ valor, config }));

  configTipo(tipo: Models.HistorialMedico.TipoEntrada | undefined): ConfigTipoOrden {
    return CONFIG_TIPO_ORDEN[tipo ?? 'consulta'];
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
  /** Perfil completo de usuarios/{miUid} cuando soyVeterinario — nombre de
   *  la clínica, teléfono/dirección, registro profesional y logo/timbre/
   *  firma. Se usa para armar el PDF de cada orden que carga (ver
   *  generarPdfOrden más abajo); no hace falta pedirlo de nuevo ahí. */
  perfilVeterinario: any = null;

  vacunas: Vacuna[] = [];
  medicamentos: Medicamento[] = [];
  examenes: Examen[] = [];
  documentos: DocumentoMascota[] = [];
  private subVacunas?: Subscription;
  private subMedicamentos?: Subscription;
  private subExamenes?: Subscription;
  private subDocumentos?: Subscription;

  /** true si soy dueño/equipo de esta mascota: solo esa cuenta puede generar
   *  el PIN y ver/revocar accesos otorgados a veterinarios. */
  puedoCompartirConVeterinario = false;
  /** true si soy dueño O parte del equipo del refugio dueño de esta mascota
   *  (a diferencia de puedoCompartirConVeterinario, que es solo dueño):
   *  gestionar hogar temporal sigue el mismo criterio que editar la
   *  mascota, no el de veterinarias/publicaciones/equipo. */
  puedoGestionarHogarTemporal = false;
  /** true si soy dueño/equipo O ya soy co-dueño/a de esta mascota — a
   *  diferencia de puedoGestionarHogarTemporal, un co-dueño SÍ puede
   *  gestionar (quitar) a otro co-dueño, con los mismos permisos. */
  puedoGestionarCoDuenos = false;

  entradasHistorial: Models.HistorialMedico.Entrada[] = [];
  accesosVeterinario: Models.Mascotas.AccesoVeterinario[] = [];
  private colaboradoresTodos: Models.Mascotas.ColaboradorMascota[] = [];
  get colaboradoresHogarTemporal(): Models.Mascotas.ColaboradorMascota[] {
    return this.colaboradoresTodos.filter(c => c.tipo === 'hogar_temporal');
  }
  get colaboradoresCoDuenos(): Models.Mascotas.ColaboradorMascota[] {
    return this.colaboradoresTodos.filter(c => c.tipo === 'co_dueno');
  }
  /** Antes era un único cuadro de texto libre; ahora captura una atención
   *  estructurada (motivo/diagnóstico/tratamiento) — "texto" queda para
   *  observaciones sueltas que no encajan en los otros 3 campos. Al menos
   *  uno de los 4 tiene que venir completo para poder guardar. "tipo" solo
   *  cambia las etiquetas que ve el veterinario (ver CONFIG_TIPO_ORDEN);
   *  el dato que se guarda son los mismos 4 campos de siempre. */
  nuevaEntrada: { tipo: Models.HistorialMedico.TipoEntrada; motivo: string; diagnostico: string; tratamiento: string; texto: string } =
    { tipo: 'consulta', motivo: '', diagnostico: '', tratamiento: '', texto: '' };
  enviandoNota = false;

  get puedeAgregarNota(): boolean {
    const n = this.nuevaEntrada;
    return !!(n.motivo.trim() || n.diagnostico.trim() || n.tratamiento.trim() || n.texto.trim());
  }

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
    if (!mascota) { this.puedoGestionarHogarTemporal = false; this.puedoGestionarCoDuenos = false; return; }
    this.refugioCtx.contexto$()
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(ctx => {
        // Mismo caso que en publicacion-detalle: ctx.todos no incluye el uid
        // propio si la cuenta no es de rol 'refugio', pero cualquier cuenta
        // puede ser dueña directa de una mascota en hogar temporal.
        this.puedoGestionarHogarTemporal = mascota.uidUsuario === ctx.miUid || ctx.todos.includes(mascota.uidUsuario);
        // Recalcula acá también (no solo cuando llegan los colaboradores):
        // los dos streams son asíncronos y pueden resolver en cualquier orden.
        this.puedoGestionarCoDuenos = this.puedoGestionarHogarTemporal
          || this.colaboradoresTodos.some(c => c.uid === this.miUid && c.tipo === 'co_dueno');
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
    this.subVacunas?.unsubscribe();
    this.subMedicamentos?.unsubscribe();
    this.subExamenes?.unsubscribe();
    this.subDocumentos?.unsubscribe();
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
      .subscribe(data => {
        this.colaboradoresTodos = data;
        this.puedoGestionarCoDuenos = this.puedoGestionarHogarTemporal
          || data.some(c => c.uid === this.miUid && c.tipo === 'co_dueno');
      });
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
      if (this.soyVeterinario) {
        this.segmentoActual = 'historial';
        this.perfilVeterinario = perfil;
      }
      this.rolListo = true;
      this.cargarDatosClinicosSiVet();
    });
  }

  /** Vacunas/medicamentos/exámenes/documentos registrados por el dueño
   *  (mascota-editar): antes un veterinario con acceso por PIN solo veía el
   *  historial de notas de texto libre, sin poder ver nada de esto pese a
   *  que las reglas de Firestore ya se lo permiten (puedeVerHistorialMedico).
   *  Solo se cargan para el veterinario — el dueño ya las administra desde
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

    this.subDocumentos?.unsubscribe();
    this.subDocumentos = this.firestoreService.getDocumentosByMascota(this.mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(data => this.documentos = data);
  }

  /** Abre la orden/resultado de un examen, o un documento adjunto, en una
   *  pestaña nueva — mismo criterio que "Ver título" en el panel admin. */
  abrirArchivo(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  /** El logo/firma/timbre del membrete son opcionales y pueden apuntar a un
   *  archivo borrado o a una URL vieja — si la imagen no carga, se oculta
   *  en vez de mostrar el ícono de imagen rota, para que la nota siga
   *  viéndose prolija. */
  ocultarImagenRota(event: Event): void {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  /** El veterinario ya podía leer los exámenes en "Resumen", pero no tenía
   *  forma de abrir el archivo de la orden/resultado que subió el dueño. */
  abrirArchivoExamen(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  /** Único camino hoy hacia "Editar mascota" para un veterinario — ese
   *  componente ya detecta soyVeterinario y muestra solo Vacunas/Exámenes/
   *  Medicamentos (nunca Info Mascota/Calendario, que son del dueño). */
  irAHistorialClinico(): void {
    this.router.navigate(['/tabs/mascota-editar', this.mascotaId, 'editar']);
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
    if (!this.puedeAgregarNota || this.enviandoNota) return;
    this.enviandoNota = true;
    try {
      // Solo el veterinario genera el PDF de la orden — es quien firma/
      // sella; una nota del dueño no tiene "clínica" ni logo que mostrar.
      if (this.soyVeterinario && this.mascota) {
        await this.firestoreService.agregarEntradaHistorialConPdf(
          this.mascotaId,
          this.mascota.uidUsuario,
          this.nuevaEntrada,
          entradaId => this.generarPdfOrden(entradaId)
        );
      } else {
        await this.firestoreService.agregarEntradaHistorial(this.mascotaId, this.nuevaEntrada);
      }
      // Mantiene el tipo elegido: es común cargar varias órdenes del mismo
      // tipo seguidas (ej. varias vacunas en la misma visita).
      this.nuevaEntrada = { tipo: this.nuevaEntrada.tipo, motivo: '', diagnostico: '', tratamiento: '', texto: '' };
    } catch {
      await this.mostrarToast('No se pudo guardar la nota. Intenta nuevamente.', 'danger');
    } finally {
      this.enviandoNota = false;
    }
  }

  /** Arma el PDF de la orden con los datos ya cargados en pantalla: la
   *  mascota (this.mascota), el perfil del veterinario logueado
   *  (perfilVeterinario, con su logo/timbre/firma) y los campos que llenó
   *  en el formulario, ya con la etiqueta que corresponde al tipo elegido
   *  (ver CONFIG_TIPO_ORDEN). */
  private async generarPdfOrden(entradaId: string): Promise<Blob> {
    const perfil = this.perfilVeterinario;
    const config = this.configTipo(this.nuevaEntrada.tipo);

    const campos: { label: string; valor: string }[] = [];
    if (this.nuevaEntrada.motivo.trim()) campos.push({ label: config.motivoLabel, valor: this.nuevaEntrada.motivo.trim() });
    if (this.nuevaEntrada.diagnostico.trim()) campos.push({ label: config.diagnosticoLabel, valor: this.nuevaEntrada.diagnostico.trim() });
    if (this.nuevaEntrada.tratamiento.trim()) campos.push({ label: config.tratamientoLabel, valor: this.nuevaEntrada.tratamiento.trim() });
    if (this.nuevaEntrada.texto.trim()) campos.push({ label: config.textoLabel, valor: this.nuevaEntrada.texto.trim() });

    return this.ordenPdfSvc.generar(
      {
        nombreClinica: perfil?.nombreClinica ?? null,
        direccionNegocio: perfil?.direccionNegocio ?? null,
        telefonoNegocio: perfil?.telefonoNegocio ?? null,
        nombreVeterinario: `${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim() || 'Veterinario/a',
        numeroRegistroProfesional: perfil?.numeroRegistroProfesional ?? null,
        logoUrl: perfil?.logoUrl ?? null,
        timbreUrl: perfil?.timbreUrl ?? null,
        firmaUrl: perfil?.firmaUrl ?? null,
      },
      {
        nombre: this.mascota?.nombre ?? '',
        especie: this.mascota?.especie,
        raza: this.mascota?.raza,
        sexo: this.mascota?.sexo,
        edad: this.mascota?.edad,
        peso: this.mascota?.peso,
        color: this.mascota?.color,
        numeroChip: this.mascota?.numeroChip,
      },
      { entradaId, tipoLabel: config.label, campos, fecha: new Date() }
    );
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

  // ── Co-dueños ─────────────────────────────────────────────────────────────

  async quitarCoDueno(colab: Models.Mascotas.ColaboradorMascota): Promise<void> {
    if (!this.puedoGestionarCoDuenos) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar co-dueño/a',
      message: `¿Quitarle a "${colab.nombre}" los permisos de co-dueño/a de ${this.mascota?.nombre ?? 'esta mascota'}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.quitarColaboradorMascota(this.mascotaId, colab.uid);
              await this.mostrarToast('Se quitó el acceso de co-dueño/a.', 'success');
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