import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { checkmarkCircleOutline, closeCircleOutline, documentTextOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { Subscription } from 'rxjs';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

type Vista = 'veterinario' | 'refugio';

const ETIQUETAS_TIPO_NEGOCIO: Record<string, string> = {
  independiente: 'Veterinario/a independiente',
  clinica_pequena: 'Clínica pequeña',
  clinica_grande: 'Clínica grande',
};

/**
 * Panel admin (solo cuenta de Ashbis, ver adminGuard) para aprobar o
 * rechazar la verificación antifraude de cuentas profesionales: el título
 * de un veterinario, o el documento legal de un refugio (mismo campo
 * `verificado`, misma Cloud Function). Sin esto, "verificado" nunca se
 * podía setear salvo editando la base de datos a mano — y
 * validarPinVeterinario ahora EXIGE verificado=true antes de dejar a un
 * veterinario pedir acceso al historial de una mascota.
 */
@Component({
  selector: 'app-admin-veterinarios',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonSpinner,
    IonSegment, IonSegmentButton, IonLabel,
  ],
  templateUrl: './admin-veterinarios.component.html',
  styleUrls: ['./admin-veterinarios.component.scss'],
})
export class AdminVeterinariosComponent implements OnInit, OnDestroy {
  private readonly fs = inject(FirestoreService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private subVeterinarios?: Subscription;
  private subRefugios?: Subscription;

  vista = signal<Vista>('veterinario');

  cargandoVeterinarios = signal(true);
  cargandoRefugios = signal(true);
  pendientesVeterinarios = signal<Models.Auth.UserProfile[]>([]);
  pendientesRefugios = signal<Models.Auth.UserProfile[]>([]);
  procesando = signal<string | null>(null);

  /** Deriva de cuál de las dos listas mirar según el segmento elegido, sin
   *  bloquear una consulta con la otra (cada una carga en paralelo). */
  cargando = computed(() =>
    this.vista() === 'veterinario' ? this.cargandoVeterinarios() : this.cargandoRefugios()
  );
  pendientes = computed(() =>
    this.vista() === 'veterinario' ? this.pendientesVeterinarios() : this.pendientesRefugios()
  );

  readonly etiquetasTipoNegocio = ETIQUETAS_TIPO_NEGOCIO;

  constructor() {
    addIcons({ checkmarkCircleOutline, closeCircleOutline, documentTextOutline, shieldCheckmarkOutline });
  }

  ngOnInit(): void {
    this.subVeterinarios = this.fs.getVeterinariosPendientes().subscribe(lista => {
      // Los que todavía no subieron ningún título no tienen nada que
      // revisar todavía — se ordenan al final para no tapar los que sí.
      const ordenada = [...lista].sort((a, b) => (b.tituloUrl ? 1 : 0) - (a.tituloUrl ? 1 : 0));
      this.pendientesVeterinarios.set(ordenada);
      this.cargandoVeterinarios.set(false);
    });
    this.subRefugios = this.fs.getRefugiosPendientes().subscribe(lista => {
      const ordenada = [...lista].sort((a, b) => (b.documentoLegalUrl ? 1 : 0) - (a.documentoLegalUrl ? 1 : 0));
      this.pendientesRefugios.set(ordenada);
      this.cargandoRefugios.set(false);
    });
  }

  ngOnDestroy(): void {
    this.subVeterinarios?.unsubscribe();
    this.subRefugios?.unsubscribe();
  }

  cambiarVista(v: string | number | undefined): void {
    if (v === 'veterinario' || v === 'refugio') this.vista.set(v);
  }

  documentoUrl(v: Models.Auth.UserProfile): string | null {
    return this.vista() === 'veterinario' ? (v.tituloUrl ?? null) : (v.documentoLegalUrl ?? null);
  }

  abrirDocumento(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  nombreMostrado(v: Models.Auth.UserProfile): string {
    if (this.vista() === 'refugio') return v.nombreRefugio?.trim() || v.email || 'Sin nombre';
    return this.nombreCompleto(v);
  }

  async aprobar(v: Models.Auth.UserProfile): Promise<void> {
    const mensaje = this.vista() === 'veterinario'
      ? `¿Confirmas que el título de "${this.nombreCompleto(v)}" es válido? Podrá atender pacientes por PIN.`
      : `¿Confirmas que el documento legal de "${this.nombreMostrado(v)}" es válido? Sus publicaciones mostrarán la insignia de refugio verificado.`;
    await this.confirmarYRevisar(v, true, 'Aprobar verificación', mensaje);
  }

  async rechazar(v: Models.Auth.UserProfile): Promise<void> {
    const mensaje = this.vista() === 'veterinario'
      ? `"${this.nombreCompleto(v)}" va a seguir sin poder pedir acceso a historiales hasta que suba un título válido.`
      : `"${this.nombreMostrado(v)}" va a seguir sin la insignia de verificado hasta que suba un documento válido.`;
    await this.confirmarYRevisar(v, false, 'Rechazar verificación', mensaje);
  }

  private async confirmarYRevisar(v: Models.Auth.UserProfile, aprobar: boolean, header: string, message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: aprobar ? 'Aprobar' : 'Rechazar',
          handler: async () => {
            this.procesando.set(v.uid);
            try {
              await this.fs.revisarVerificacionVeterinario(v.uid, aprobar);
              const etiqueta = this.vista() === 'veterinario' ? 'Veterinario' : 'Refugio';
              await this.mostrarToast(aprobar ? `${etiqueta} verificado.` : 'Verificación rechazada.', 'success');
            } catch (e: any) {
              await this.mostrarToast(e?.message || 'No se pudo guardar la revisión.', 'danger');
            } finally {
              this.procesando.set(null);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  nombreCompleto(v: Models.Auth.UserProfile): string {
    return `${v.nombre ?? ''} ${v.apellido ?? ''}`.trim() || v.email || 'Sin nombre';
  }

  etiquetaTipo(v: Models.Auth.UserProfile): string | null {
    const tipo = v.tipoNegocioVeterinario as string | undefined;
    return tipo ? (this.etiquetasTipoNegocio[tipo] || tipo) : null;
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
