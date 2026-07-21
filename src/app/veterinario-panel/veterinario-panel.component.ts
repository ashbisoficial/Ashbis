import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, documentTextOutline, medkitOutline, pawOutline, shieldCheckmarkOutline,
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';

const ETIQUETAS_TIPO_NEGOCIO: Record<Models.Auth.TipoNegocioVeterinario, string> = {
  independiente: 'Veterinario independiente',
  clinica_pequena: 'Clínica pequeña',
  clinica_grande: 'Clínica grande',
  peluqueria: 'Peluquería / estética',
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
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonList, IonSpinner,
  ],
})
export class VeterinarioPanelComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly security = inject(SecurityService);
  private readonly destroy$ = new Subject<void>();

  miUid = '';
  nombre = signal('Veterinario');
  cargando = signal(true);
  pacientes = signal<Models.Mascotas.AccesoVeterinario[]>([]);

  // ── Perfil profesional ───────────────────────────────────────────────────
  nombreClinica = signal<string | null>(null);
  etiquetaTipoNegocio = signal<string | null>(null);
  etiquetaModalidad = signal<string | null>(null);
  nombreDoctor = signal<string | null>(null);
  numeroRegistroProfesional = signal<string | null>(null);
  especialidades = signal<string[]>([]);
  /** false para peluquería/estética: no requiere título ni verificación. */
  requiereVerificacion = signal(false);
  verificado = signal(false);
  tituloUrl = signal<string | null>(null);
  subiendoTitulo = signal(false);

  constructor() {
    addIcons({ addOutline, pawOutline, documentTextOutline, shieldCheckmarkOutline, medkitOutline });
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

      const tipo: Models.Auth.TipoNegocioVeterinario | undefined = perfil?.tipoNegocioVeterinario;
      this.etiquetaTipoNegocio.set(tipo ? ETIQUETAS_TIPO_NEGOCIO[tipo] : null);
      this.requiereVerificacion.set(!!tipo && tipo !== 'peluqueria');

      const modalidad: Models.Auth.ModalidadAtencion | undefined = perfil?.modalidadAtencion;
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

  async agregarPaciente(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Agregar paciente',
      message: 'Ingresa el ID de la mascota y el PIN que te compartió su dueño.',
      inputs: [
        { name: 'mascotaId', type: 'text', placeholder: 'ID de la mascota' },
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

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
