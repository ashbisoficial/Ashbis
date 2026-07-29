import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, closeCircleOutline, createOutline, documentTextOutline, medkitOutline,
  pawOutline, qrCodeOutline, ribbonOutline, shieldCheckmarkOutline, imagesOutline,
  chevronForwardOutline,
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';
import { PreferenciasService } from '../services/preferencias.service';
import { QrDecodeService } from '../services/qr-decode.service';

interface FormPerfilVeterinario {
  nombreClinica: string;
  tipoNegocioVeterinario: Models.Auth.TipoNegocioVeterinario | '';
  modalidadAtencion: Models.Auth.ModalidadAtencion | '';
  nombreDoctor: string;
  numeroRegistroProfesional: string;
  lugarEstudios: string;
  especialidadesTexto: string;
  especiesAtendidas: string[];
  direccionNegocio: string;
  telefonoNegocio: string;
}

const ESPECIES_DISPONIBLES = [
  'Perros', 'Gatos', 'Aves', 'Exóticos', 'Reptiles', 'Ganado y grandes animales', 'Otros',
];

const ETIQUETAS_TIPO_NEGOCIO: Record<Models.Auth.TipoNegocioVeterinario, string> = {
  independiente: 'Veterinario independiente',
  clinica_pequena: 'Clínica pequeña',
  clinica_grande: 'Clínica grande',
};

const ETIQUETAS_MODALIDAD: Record<Models.Auth.ModalidadAtencion, string> = {
  presencial: 'Atención presencial',
  a_domicilio: 'Atención a domicilio',
  ambas: 'Presencial y a domicilio',
};

@Component({
  selector: 'app-veterinario-panel',
  standalone: true,
  templateUrl: './veterinario-panel.component.html',
  styleUrls: ['./veterinario-panel.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonList, IonSpinner,
    IonInput, IonSelect, IonSelectOption, IonCheckbox,
  ],
})
export class VeterinarioPanelComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly security = inject(SecurityService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly qrDecodeSvc = inject(QrDecodeService);
  private readonly destroy$ = new Subject<void>();

  /** Prefijo que usa mascota-qr.component al generar el QR "para
   *  veterinario" — ver ASHBIS-MASCOTA en ese archivo. */
  private static readonly PREFIJO_QR_MASCOTA = 'ASHBIS-MASCOTA:';
  escaneandoQrPaciente = false;

  miUid = '';
  nombre = signal('Veterinario');
  cargando = signal(true);
  pacientes = signal<Models.Mascotas.AccesoVeterinario[]>([]);

  // ── Perfil profesional ───────────────────────────────────────────────────
  nombreClinica = signal<string | null>(null);
  tipoNegocioVeterinario = signal<Models.Auth.TipoNegocioVeterinario | null>(null);
  etiquetaTipoNegocio = signal<string | null>(null);
  modalidadAtencion = signal<Models.Auth.ModalidadAtencion | null>(null);
  etiquetaModalidad = signal<string | null>(null);
  nombreDoctor = signal<string | null>(null);
  numeroRegistroProfesional = signal<string | null>(null);
  especialidades = signal<string[]>([]);
  lugarEstudios = signal<string | null>(null);
  especiesAtendidas = signal<string[]>([]);
  direccionNegocio = signal<string | null>(null);
  telefonoNegocio = signal<string | null>(null);
  /** false para peluquería/estética: no requiere título ni verificación. */
  requiereVerificacion = signal(false);
  verificado = signal(false);
  tituloUrl = signal<string | null>(null);
  subiendoTitulo = signal(false);

  // ── Edición del perfil profesional ────────────────────────────────────────
  modoEdicionPerfil = signal(false);
  guardandoPerfil = false;
  formPerfil: FormPerfilVeterinario = this.formVacio();
  readonly especiesDisponibles = ESPECIES_DISPONIBLES;
  readonly opcionesTipoNegocio = Object.entries(ETIQUETAS_TIPO_NEGOCIO) as
    [Models.Auth.TipoNegocioVeterinario, string][];
  readonly opcionesModalidad = Object.entries(ETIQUETAS_MODALIDAD) as
    [Models.Auth.ModalidadAtencion, string][];

  // ── Personalización de la atención ──────────────────────────────────────
  notasPredisenadas = signal<string[]>([]);
  nuevaNotaPredisenada = '';
  guardandoNota = false;
  logoUrl = signal<string | null>(null);
  timbreUrl = signal<string | null>(null);
  firmaUrl = signal<string | null>(null);
  subiendoLogo = signal(false);
  subiendoTimbre = signal(false);
  subiendoFirma = signal(false);

  constructor() {
    addIcons({
      addOutline, pawOutline, documentTextOutline, shieldCheckmarkOutline, medkitOutline,
      createOutline, closeCircleOutline, ribbonOutline, qrCodeOutline, imagesOutline,
      chevronForwardOutline,
    });
  }

  private formVacio(): FormPerfilVeterinario {
    return {
      nombreClinica: '',
      tipoNegocioVeterinario: '',
      modalidadAtencion: '',
      nombreDoctor: '',
      numeroRegistroProfesional: '',
      lugarEstudios: '',
      especialidadesTexto: '',
      especiesAtendidas: [],
      direccionNegocio: '',
      telefonoNegocio: '',
    };
  }

  ngOnInit(): void {
    this.miUid = this.auth.getCurrentUser()?.uid ?? '';
    if (!this.miUid) return;

    this.fs.getDocument(`usuarios/${this.miUid}`).then(perfil => {
      this.nombre.set(`${perfil?.nombre ?? ''} ${perfil?.apellido ?? ''}`.trim() || 'Veterinario');
      this.nombreClinica.set(perfil?.nombreClinica?.trim() || null);
      this.nombreDoctor.set(perfil?.nombreDoctor?.trim() || null);
      this.numeroRegistroProfesional.set(perfil?.numeroRegistroProfesional?.trim() || null);
      this.especialidades.set(perfil?.especialidades ?? []);
      this.lugarEstudios.set(perfil?.lugarEstudios?.trim() || null);
      this.especiesAtendidas.set(perfil?.especiesAtendidas ?? []);
      this.direccionNegocio.set(perfil?.direccionNegocio?.trim() || null);
      this.telefonoNegocio.set(perfil?.telefonoNegocio?.trim() || null);
      this.notasPredisenadas.set(perfil?.notasPredisenadas ?? []);
      this.logoUrl.set(perfil?.logoUrl ?? null);
      this.timbreUrl.set(perfil?.timbreUrl ?? null);
      this.firmaUrl.set(perfil?.firmaUrl ?? null);

      const tipo: Models.Auth.TipoNegocioVeterinario | undefined = perfil?.tipoNegocioVeterinario;
      this.tipoNegocioVeterinario.set(tipo ?? null);
      this.etiquetaTipoNegocio.set(tipo ? ETIQUETAS_TIPO_NEGOCIO[tipo] : null);
      // Los tres tipos que quedan en 'veterinario' implican práctica médica
      // — peluquería/estética se movió al rol 'servicio', que no pasa por
      // verificación.
      this.requiereVerificacion.set(!!tipo);

      const modalidad: Models.Auth.ModalidadAtencion | undefined = perfil?.modalidadAtencion;
      this.modalidadAtencion.set(modalidad ?? null);
      this.etiquetaModalidad.set(modalidad ? ETIQUETAS_MODALIDAD[modalidad] : null);

      this.verificado.set(perfil?.verificado === true);
      this.tituloUrl.set(perfil?.tituloUrl ?? null);
    });

    this.fs.getMisPacientesVeterinario(this.miUid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(pacientes => {
        this.pacientes.set(pacientes ?? []);
        this.cargando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, p: Models.Mascotas.AccesoVeterinario) => p.mascotaId;

  verPaciente(p: Models.Mascotas.AccesoVeterinario): void {
    this.router.navigate(['/tabs/mascota-detalle', p.mascotaId]);
  }

  /** Abre el selector de archivo solo si la cámara/galería está habilitada
   *  en Configuración → Permisos (preferencia propia de Ashbis, no el
   *  permiso real del navegador). */
  abrirSelectorArchivo(input: HTMLInputElement): void {
    if (!this.preferencias.camaraHabilitada) {
      this.mostrarToast('Activá la cámara en Configuración → Permisos para subir archivos.', 'danger');
      return;
    }
    input.click();
  }

  /** Antes de dejar pedir la verificación, exige que ya haya un teléfono de
   *  la clínica/consulta cargado — evita cuentas fantasma que suben un
   *  título cualquiera sin ningún dato de contacto real detrás. */
  abrirSelectorTitulo(input: HTMLInputElement): void {
    if (!this.telefonoNegocio()) {
      this.mostrarToast('Agregá el teléfono de tu clínica/consulta antes de pedir la verificación (tocá el lápiz para editarlo).', 'danger');
      return;
    }
    this.abrirSelectorArchivo(input);
  }

  async subirTitulo(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxMb: 15,
    });
    if (error) {
      await this.mostrarToast(error, 'danger');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    this.subiendoTitulo.set(true);
    try {
      const url = await this.fs.actualizarTituloVeterinario(this.miUid, file);
      this.tituloUrl.set(url);
      await this.mostrarToast('Título enviado. El equipo de Ashbis lo va a revisar.', 'success');
    } catch {
      await this.mostrarToast('No se pudo subir el título. Intenta nuevamente.', 'danger');
    } finally {
      this.subiendoTitulo.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  /** @param mascotaIdPrellenado Si viene de escanear el QR "para
   *  veterinario" de mascota-qr.component, ya trae el ID cargado — el PIN
   *  igual hay que tipearlo: el QR no reemplaza esa autorización, solo
   *  evita escribir el ID a mano. */
  async agregarPaciente(mascotaIdPrellenado?: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Agregar paciente',
      message: 'Ingresa el ID de la mascota y el PIN que te compartió su dueño.',
      inputs: [
        { name: 'mascotaId', type: 'text', placeholder: 'ID de la mascota', value: mascotaIdPrellenado ?? '' },
        { name: 'pin', type: 'text', placeholder: 'PIN (6 dígitos)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Acceder',
          handler: async (data) => {
            const mascotaId = String(data.mascotaId || '').trim();
            const pin = String(data.pin || '').trim();
            if (!mascotaId || !pin) {
              await this.mostrarToast('Completa el ID y el PIN.', 'danger');
              return false;
            }
            try {
              const mascota = await this.fs.validarPinVeterinario(mascotaId, pin);
              await this.mostrarToast(`Acceso otorgado a ${mascota.nombre}.`, 'success');
              return true;
            } catch (err: any) {
              await this.mostrarToast(err?.message || 'No se pudo validar el PIN.', 'danger');
              return false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  /** Escanea el QR "para veterinario" (mascota-qr.component) para no tener
   *  que tipear el ID a mano — el PIN se sigue pidiendo aparte, ver
   *  agregarPaciente(). */
  async escanearQrPaciente(input: HTMLInputElement): Promise<void> {
    if (!this.preferencias.camaraHabilitada) {
      await this.mostrarToast('Activá la cámara en Configuración → Permisos para escanear un QR.', 'danger');
      return;
    }
    input.click();
  }

  async onQrPacienteSeleccionado(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.escaneandoQrPaciente = true;
    try {
      const texto = await this.qrDecodeSvc.decodificarArchivo(file);
      if (!texto?.startsWith(VeterinarioPanelComponent.PREFIJO_QR_MASCOTA)) {
        await this.mostrarToast('Ese código QR no es un QR de mascota para veterinario.', 'danger');
        return;
      }
      const mascotaId = texto.slice(VeterinarioPanelComponent.PREFIJO_QR_MASCOTA.length);
      await this.agregarPaciente(mascotaId);
    } catch {
      await this.mostrarToast('No se pudo leer el código QR. Intenta de nuevo.', 'danger');
    } finally {
      this.escaneandoQrPaciente = false;
    }
  }

  // ── Edición del perfil profesional ────────────────────────────────────────

  iniciarEdicionPerfil(): void {
    this.formPerfil = {
      nombreClinica: this.nombreClinica() ?? '',
      tipoNegocioVeterinario: this.tipoNegocioVeterinario() ?? '',
      modalidadAtencion: this.modalidadAtencion() ?? '',
      nombreDoctor: this.nombreDoctor() ?? '',
      numeroRegistroProfesional: this.numeroRegistroProfesional() ?? '',
      lugarEstudios: this.lugarEstudios() ?? '',
      especialidadesTexto: this.especialidades().join(', '),
      especiesAtendidas: [...this.especiesAtendidas()],
      direccionNegocio: this.direccionNegocio() ?? '',
      telefonoNegocio: this.telefonoNegocio() ?? '',
    };
    this.modoEdicionPerfil.set(true);
  }

  cancelarEdicionPerfil(): void {
    this.modoEdicionPerfil.set(false);
  }

  toggleEspecie(especie: string, marcada: boolean): void {
    const set = new Set(this.formPerfil.especiesAtendidas);
    if (marcada) set.add(especie); else set.delete(especie);
    this.formPerfil.especiesAtendidas = Array.from(set);
  }

  async guardarPerfilProfesional(): Promise<void> {
    if (this.guardandoPerfil) return;
    this.guardandoPerfil = true;
    try {
      const f = this.formPerfil;
      const especialidades = f.especialidadesTexto
        .split(',')
        .map(e => this.security.sanitizeText(e.trim(), 60))
        .filter(Boolean);

      const payload = {
        nombreClinica: this.security.sanitizeText(f.nombreClinica, 200),
        ...(f.tipoNegocioVeterinario ? { tipoNegocioVeterinario: f.tipoNegocioVeterinario } : {}),
        ...(f.modalidadAtencion ? { modalidadAtencion: f.modalidadAtencion } : {}),
        nombreDoctor: this.security.sanitizeText(f.nombreDoctor, 200),
        numeroRegistroProfesional: this.security.sanitizeText(f.numeroRegistroProfesional, 100),
        lugarEstudios: this.security.sanitizeText(f.lugarEstudios, 200),
        especialidades,
        especiesAtendidas: f.especiesAtendidas,
        ...(f.direccionNegocio.trim() ? { direccionNegocio: this.security.sanitizeText(f.direccionNegocio, 200) } : {}),
        ...(f.telefonoNegocio.trim() ? { telefonoNegocio: this.security.sanitizeText(f.telefonoNegocio, 30) } : {}),
      };
      await this.fs.updateDocument(`usuarios/${this.miUid}`, payload);

      this.nombreClinica.set(payload.nombreClinica || null);
      this.nombreDoctor.set(payload.nombreDoctor || null);
      this.numeroRegistroProfesional.set(payload.numeroRegistroProfesional || null);
      this.lugarEstudios.set(payload.lugarEstudios || null);
      this.especialidades.set(especialidades);
      this.especiesAtendidas.set(f.especiesAtendidas);
      if ('direccionNegocio' in payload) this.direccionNegocio.set(payload.direccionNegocio || null);
      if ('telefonoNegocio' in payload) this.telefonoNegocio.set(payload.telefonoNegocio || null);
      if (f.tipoNegocioVeterinario) {
        this.tipoNegocioVeterinario.set(f.tipoNegocioVeterinario);
        this.etiquetaTipoNegocio.set(ETIQUETAS_TIPO_NEGOCIO[f.tipoNegocioVeterinario]);
        this.requiereVerificacion.set(true);
      }
      if (f.modalidadAtencion) {
        this.modalidadAtencion.set(f.modalidadAtencion);
        this.etiquetaModalidad.set(ETIQUETAS_MODALIDAD[f.modalidadAtencion]);
      }

      this.modoEdicionPerfil.set(false);
      await this.mostrarToast('Perfil profesional actualizado.', 'success');
    } catch {
      await this.mostrarToast('No se pudo guardar. Intenta nuevamente.', 'danger');
    } finally {
      this.guardandoPerfil = false;
    }
  }

  // ── Personalización de la atención ──────────────────────────────────────

  async agregarNotaPredisenada(): Promise<void> {
    const texto = this.security.sanitizeText(this.nuevaNotaPredisenada.trim(), 300);
    if (!texto || this.guardandoNota) return;
    this.guardandoNota = true;
    try {
      const notas = [...this.notasPredisenadas(), texto];
      await this.fs.updateDocument(`usuarios/${this.miUid}`, { notasPredisenadas: notas });
      this.notasPredisenadas.set(notas);
      this.nuevaNotaPredisenada = '';
    } catch {
      await this.mostrarToast('No se pudo guardar la nota. Intenta nuevamente.', 'danger');
    } finally {
      this.guardandoNota = false;
    }
  }

  async quitarNotaPredisenada(nota: string): Promise<void> {
    try {
      const notas = this.notasPredisenadas().filter(n => n !== nota);
      await this.fs.updateDocument(`usuarios/${this.miUid}`, { notasPredisenadas: notas });
      this.notasPredisenadas.set(notas);
    } catch {
      await this.mostrarToast('No se pudo quitar la nota. Intenta nuevamente.', 'danger');
    }
  }

  async subirImagenPersonalizacion(event: Event, tipo: 'logo' | 'timbre' | 'firma'): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxMb: 5,
    });
    if (error) {
      await this.mostrarToast(error, 'danger');
      return;
    }

    const señal = tipo === 'logo' ? this.subiendoLogo : tipo === 'timbre' ? this.subiendoTimbre : this.subiendoFirma;
    señal.set(true);
    try {
      const url = await this.fs.subirImagenPersonalizacion(this.miUid, tipo, file);
      if (tipo === 'logo') this.logoUrl.set(url);
      else if (tipo === 'timbre') this.timbreUrl.set(url);
      else this.firmaUrl.set(url);
      await this.mostrarToast('Imagen actualizada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo subir la imagen. Intenta nuevamente.', 'danger');
    } finally {
      señal.set(false);
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
