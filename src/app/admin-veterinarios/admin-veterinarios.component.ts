import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
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

const ETIQUETAS_TIPO_NEGOCIO: Record<string, string> = {
  independiente: 'Veterinario/a independiente',
  clinica_pequena: 'Clínica pequeña',
  clinica_grande: 'Clínica grande',
};

/**
 * Panel admin (solo cuenta de Ashbis, ver adminGuard) para aprobar o
 * rechazar el título profesional que sube un veterinario al registrarse.
 * Sin esto, "verificado" nunca se podía setear salvo editando la base de
 * datos a mano — y validarPinVeterinario ahora EXIGE verificado=true antes
 * de dejar a un veterinario pedir acceso al historial de una mascota.
 */
@Component({
  selector: 'app-admin-veterinarios',
  standalone: true,
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardContent, IonButton, IonIcon, IonSpinner,
  ],
  templateUrl: './admin-veterinarios.component.html',
  styleUrls: ['./admin-veterinarios.component.scss'],
})
export class AdminVeterinariosComponent implements OnInit, OnDestroy {
  private readonly fs = inject(FirestoreService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private sub?: Subscription;

  cargando = signal(true);
  pendientes = signal<Models.Auth.UserProfile[]>([]);
  procesando = signal<string | null>(null);

  readonly etiquetasTipoNegocio = ETIQUETAS_TIPO_NEGOCIO;

  constructor() {
    addIcons({ checkmarkCircleOutline, closeCircleOutline, documentTextOutline, shieldCheckmarkOutline });
  }

  ngOnInit(): void {
    this.sub = this.fs.getVeterinariosPendientes().subscribe(lista => {
      // Los que todavía no subieron ningún título no tienen nada que
      // revisar todavía — se ordenan al final para no tapar los que sí.
      const ordenada = [...lista].sort((a, b) => (b.tituloUrl ? 1 : 0) - (a.tituloUrl ? 1 : 0));
      this.pendientes.set(ordenada);
      this.cargando.set(false);
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  abrirTitulo(url: string): void {
    window.open(url, '_blank', 'noopener');
  }

  async aprobar(v: Models.Auth.UserProfile): Promise<void> {
    await this.confirmarYRevisar(v, true, 'Aprobar verificación', `¿Confirmás que el título de "${this.nombreCompleto(v)}" es válido? Va a poder atender pacientes por PIN.`);
  }

  async rechazar(v: Models.Auth.UserProfile): Promise<void> {
    await this.confirmarYRevisar(v, false, 'Rechazar verificación', `"${this.nombreCompleto(v)}" va a seguir sin poder pedir acceso a historiales hasta que suba un título válido.`);
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
              await this.mostrarToast(aprobar ? 'Veterinario verificado.' : 'Verificación rechazada.', 'success');
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
