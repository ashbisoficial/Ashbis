import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnDestroy, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
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
  IonInput,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  businessOutline, createOutline, storefrontOutline, imageOutline,
  globeOutline, logoInstagram, logoFacebook, logoWhatsapp,
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { PreferenciasService } from '../services/preferencias.service';
import { SecurityService } from '../services/security.service';

const ETIQUETAS_TIPO_SERVICIO: Record<Models.Auth.TipoServicio, string> = {
  peluqueria: 'Peluquería o servicios estéticos',
  guarderia: 'Guardería o pensión',
  funeraria: 'Servicios funerarios',
};

interface FormPerfilServicio {
  nombreNegocio: string;
  tipoServicio: Models.Auth.TipoServicio | '';
  direccion: string;
  telefono: string;
  descripcion: string;
  sitioWeb: string;
  instagram: string;
  facebook: string;
  whatsappNegocio: string;
}

@Component({
  selector: 'app-servicio-panel',
  standalone: true,
  templateUrl: './servicio-panel.component.html',
  styleUrls: ['./servicio-panel.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonSpinner,
    IonInput, IonSelect, IonSelectOption, IonTextarea,
  ],
})
export class ServicioPanelComponent implements OnInit, OnDestroy {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly security = inject(SecurityService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('logoInput') private logoInputRef?: ElementRef<HTMLInputElement>;

  miUid = '';
  cargando = signal(true);

  nombreNegocio = signal<string | null>(null);
  tipoServicio = signal<Models.Auth.TipoServicio | null>(null);
  etiquetaTipoServicio = signal<string | null>(null);
  direccion = signal<string | null>(null);
  telefono = signal<string | null>(null);
  descripcion = signal<string | null>(null);
  logoUrl = signal<string | null>(null);
  sitioWeb = signal<string | null>(null);
  instagram = signal<string | null>(null);
  facebook = signal<string | null>(null);
  whatsappNegocio = signal<string | null>(null);
  subiendoLogo = signal(false);

  modoEdicion = signal(false);
  guardando = false;
  form: FormPerfilServicio = this.formVacio();
  readonly tiposServicio = Object.entries(ETIQUETAS_TIPO_SERVICIO) as [Models.Auth.TipoServicio, string][];

  constructor() {
    addIcons({
      businessOutline, createOutline, storefrontOutline, imageOutline,
      globeOutline, logoInstagram, logoFacebook, logoWhatsapp,
    });
  }

  ngOnInit(): void {
    this.miUid = this.auth.getCurrentUser()?.uid ?? '';
    if (!this.miUid) { this.cargando.set(false); return; }

    this.fs.getDocumentChanges<Models.Auth.UserProfile>(`usuarios/${this.miUid}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe(perfil => {
        this.nombreNegocio.set(perfil?.nombreNegocio ?? null);
        this.tipoServicio.set(perfil?.tipoServicio ?? null);
        this.etiquetaTipoServicio.set(perfil?.tipoServicio ? ETIQUETAS_TIPO_SERVICIO[perfil.tipoServicio] : null);
        this.direccion.set(perfil?.direccion ?? null);
        this.telefono.set(perfil?.telefono ?? null);
        this.descripcion.set(perfil?.descripcion ?? null);
        this.logoUrl.set(perfil?.logoUrl ?? null);
        this.sitioWeb.set(perfil?.sitioWeb ?? null);
        this.instagram.set(perfil?.instagram ?? null);
        this.facebook.set(perfil?.facebook ?? null);
        this.whatsappNegocio.set(perfil?.whatsappNegocio ?? null);
        this.cargando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private formVacio(): FormPerfilServicio {
    return {
      nombreNegocio: '', tipoServicio: '', direccion: '', telefono: '', descripcion: '',
      sitioWeb: '', instagram: '', facebook: '', whatsappNegocio: '',
    };
  }

  iniciarEdicion(): void {
    this.form = {
      nombreNegocio: this.nombreNegocio() ?? '',
      tipoServicio: this.tipoServicio() ?? '',
      direccion: this.direccion() ?? '',
      telefono: this.telefono() ?? '',
      descripcion: this.descripcion() ?? '',
      sitioWeb: this.sitioWeb() ?? '',
      instagram: this.instagram() ?? '',
      facebook: this.facebook() ?? '',
      whatsappNegocio: this.whatsappNegocio() ?? '',
    };
    this.modoEdicion.set(true);
  }

  cancelarEdicion(): void {
    this.modoEdicion.set(false);
  }

  async guardar(): Promise<void> {
    if (this.guardando || !this.miUid) return;
    if (!this.form.tipoServicio || !this.form.nombreNegocio.trim()) {
      await this.mostrarToast('Completa el tipo de servicio y el nombre del negocio.', 'danger');
      return;
    }
    const sitioWeb = this.form.sitioWeb.trim() ? this.security.sanitizeUrl(this.form.sitioWeb) : '';
    const instagram = this.form.instagram.trim() ? this.security.sanitizeUrl(this.form.instagram) : '';
    const facebook = this.form.facebook.trim() ? this.security.sanitizeUrl(this.form.facebook) : '';
    if ((this.form.sitioWeb.trim() && !sitioWeb) || (this.form.instagram.trim() && !instagram) || (this.form.facebook.trim() && !facebook)) {
      await this.mostrarToast('Los links deben empezar con http:// o https://', 'danger');
      return;
    }

    this.guardando = true;
    try {
      await this.fs.updateDocument(`usuarios/${this.miUid}`, {
        nombreNegocio: this.security.sanitizeText(this.form.nombreNegocio, 120),
        tipoServicio: this.form.tipoServicio,
        ...(this.form.direccion.trim() ? { direccion: this.security.sanitizeText(this.form.direccion, 200) } : {}),
        ...(this.form.telefono.trim() ? { telefono: this.security.sanitizeText(this.form.telefono, 30) } : {}),
        ...(this.form.descripcion.trim() ? { descripcion: this.security.sanitizeText(this.form.descripcion, 500) } : {}),
        ...(sitioWeb ? { sitioWeb } : {}),
        ...(instagram ? { instagram } : {}),
        ...(facebook ? { facebook } : {}),
        ...(this.form.whatsappNegocio.trim() ? { whatsappNegocio: this.security.sanitizeText(this.form.whatsappNegocio, 30).replace(/\D/g, '') } : {}),
      });
      this.modoEdicion.set(false);
      await this.mostrarToast('Datos guardados.', 'success');
    } catch {
      await this.mostrarToast('No se pudo guardar. Intenta nuevamente.', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  abrirSelectorLogo(): void {
    if (!this.preferencias.camaraHabilitada) {
      this.mostrarToast('Activá la cámara en Configuración → Permisos para subir archivos.', 'danger');
      return;
    }
    this.logoInputRef?.nativeElement.click();
  }

  async subirLogo(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !this.miUid) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
      maxMb: 5,
    });
    if (error) {
      await this.mostrarToast(error, 'danger');
      return;
    }

    this.subiendoLogo.set(true);
    try {
      const url = await this.fs.subirImagenPersonalizacion(this.miUid, 'logo', file);
      this.logoUrl.set(url);
      await this.mostrarToast('Logo actualizado.', 'success');
    } catch {
      await this.mostrarToast('No se pudo subir el logo. Intenta nuevamente.', 'danger');
    } finally {
      this.subiendoLogo.set(false);
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2200, color });
    await toast.present();
  }
}
