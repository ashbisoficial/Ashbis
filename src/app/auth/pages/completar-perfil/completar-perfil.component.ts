import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCheckbox,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonImg,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonProgressBar,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonThumbnail,
  IonTitle,
  IonToolbar,
  IonButtons
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  closeOutline,
  personOutline, homeOutline, medkitOutline, storefrontOutline, bagHandleOutline,
} from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';
import { TerminosContenidoComponent } from 'src/app/terminos/terminos-contenido.component';
import { PrivacidadContenidoComponent } from 'src/app/privacidad/privacidad-contenido.component';
import { RegionComunaSelectComponent } from 'src/app/shared/components/region-comuna-select/region-comuna-select.component';

/**
 * Paso extra SOLO para el primer login con Google: a diferencia del registro
 * con email/contraseña, Google nunca pasó por un selector de tipo de cuenta,
 * así que a todos les quedaba el rol 'usuario' fijo para siempre (las reglas
 * de Firestore prohíben cambiar `rol` después de creada la cuenta). Esta
 * pantalla junta esa elección — nombre/apellido/email/foto ya vienen de
 * Google, así que no se piden de nuevo.
 */
@Component({
  selector: 'app-completar-perfil',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonButtons,
    IonIcon,
    IonImg,
    IonNote,
    IonSpinner,
    IonThumbnail,
    IonCheckbox,
    IonModal,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonProgressBar,
    TerminosContenidoComponent,
    PrivacidadContenidoComponent,
    RegionComunaSelectComponent
  ],
  templateUrl: './completar-perfil.component.html',
  styleUrls: ['./completar-perfil.component.scss']
})
export class CompletarPerfilComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);

  cargando = false;
  cargandoInicial = true;
  errorGuardado: string | null = null;
  mostrarModalTerminos = false;
  mostrarModalPrivacidad = false;

  telefonoRegex = /^\+569\d{8}$/;

  form = this.fb.group(
    {
      telefono: ['', [Validators.required, Validators.pattern(this.telefonoRegex)]],
      region: ['', Validators.required],
      comuna: ['', Validators.required],
      rol: ['usuario' as Models.Auth.Rol, Validators.required],
      nombreRefugio: [''],
      nombreClinica: [''],
      tipoNegocioVeterinario: ['' as Models.Auth.TipoNegocioVeterinario | ''],
      nombreDoctor: [''],
      numeroRegistroProfesional: [''],
      especialidadesInput: [''],
      modalidadAtencion: ['' as Models.Auth.ModalidadAtencion | ''],
      nombreNegocio: [''],
      tipoServicio: ['' as Models.Auth.TipoServicio | ''],
      tipoPyme: ['' as Models.Auth.TipoPyme | ''],
      consentimiento: [false, [Validators.requiredTrue]]
    },
    { validators: [this.rolExtraValidator()] }
  );

  tituloFile: File | null = null;
  tituloNombre: string | null = null;
  errorTitulo: string | null = null;

  readonly tiposNegocioVeterinario: { value: Models.Auth.TipoNegocioVeterinario; label: string }[] = [
    { value: 'independiente', label: 'Veterinario/a independiente' },
    { value: 'clinica_pequena', label: 'Veterinaria pequeña (menos de 10 personas)' },
    { value: 'clinica_grande', label: 'Veterinaria grande o clínica (15 o más personas)' },
  ];

  readonly tiposServicio: { value: Models.Auth.TipoServicio; label: string }[] = [
    { value: 'peluqueria', label: 'Peluquería o servicios estéticos' },
    { value: 'guarderia', label: 'Guardería o pensión' },
    { value: 'funeraria', label: 'Servicios funerarios' },
    { value: 'hotel', label: 'Hotel para mascotas' },
    { value: 'transporte', label: 'Transporte de mascotas' },
  ];

  readonly tiposPyme: { value: Models.Auth.TipoPyme; label: string }[] = [
    { value: 'ropa', label: 'Ropa y accesorios de vestir' },
    { value: 'juguetes', label: 'Juguetes' },
    { value: 'accesorios', label: 'Accesorios (correas, comederos, camas...)' },
    { value: 'comida', label: 'Alimento para mascotas' },
    { value: 'snacks', label: 'Snacks y premios' },
    { value: 'otro', label: 'Otro' },
  ];

  private uid = '';
  nombreGoogle = '';

  readonly tiposCuenta: { valor: Models.Auth.Rol; label: string; icono: string }[] = [
    { valor: 'usuario', label: 'Dueño', icono: 'person-outline' },
    { valor: 'refugio', label: 'Refugio', icono: 'home-outline' },
    { valor: 'veterinario', label: 'Veterinario', icono: 'medkit-outline' },
    { valor: 'servicio', label: 'Servicio', icono: 'storefront-outline' },
    { valor: 'pyme', label: 'Pyme', icono: 'bag-handle-outline' },
  ];

  constructor() {
    addIcons({
      closeOutline,
      personOutline, homeOutline, medkitOutline, storefrontOutline, bagHandleOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    const user = this.authenticationService.getCurrentUser();
    if (!user) {
      this.router.navigate(['/login'], { replaceUrl: true });
      return;
    }
    this.uid = user.uid;
    this.nombreGoogle = user.displayName || user.email || '';

    // Si por algún motivo ya tiene perfil (volvió a entrar a esta URL a
    // mano, o el perfil se creó en otra pestaña), no la vuelve a mostrar.
    const existente = await this.firestoreService.getDocument(`usuarios/${this.uid}`);
    if (existente) {
      this.router.navigate(['/tabs/home'], { replaceUrl: true });
      return;
    }
    this.cargandoInicial = false;
  }

  get f() {
    return this.form.controls;
  }

  // ── Pasos del formulario ─────────────────────────────────────────────────
  // Mismo FormGroup de siempre, solo se muestra un paso a la vez. El paso 1
  // ("Datos del rol") se salta para 'usuario', que no tiene campos propios.
  readonly ULTIMO_PASO = 2;
  pasoActual = 0;

  private readonly titulosPaso: Record<number, string> = {
    0: 'Tipo de cuenta',
    1: 'Datos de tu cuenta',
    2: 'Datos personales',
  };

  get tituloPasoActual(): string {
    return this.titulosPaso[this.pasoActual] || '';
  }

  get pasosVisibles(): number[] {
    const base = [0, 1, 2];
    return this.f.rol.value === 'usuario' ? base.filter(p => p !== 1) : base;
  }

  get posicionPaso(): number {
    return this.pasosVisibles.indexOf(this.pasoActual) + 1;
  }

  get totalPasosVisibles(): number {
    return this.pasosVisibles.length;
  }

  get progresoPaso(): number {
    return this.posicionPaso / this.totalPasosVisibles;
  }

  siguiente(): void {
    if (!this.validarPaso(this.pasoActual)) return;
    const visibles = this.pasosVisibles;
    const posicionActual = visibles.indexOf(this.pasoActual);
    this.pasoActual = visibles[posicionActual + 1] ?? this.pasoActual;
  }

  atras(): void {
    const visibles = this.pasosVisibles;
    const posicionActual = visibles.indexOf(this.pasoActual);
    this.pasoActual = visibles[posicionActual - 1] ?? this.pasoActual;
  }

  private controlesPaso(paso: number): string[] {
    switch (paso) {
      case 2: return ['telefono', 'region', 'comuna', 'consentimiento'];
      default: return [];
    }
  }

  private validarPaso(paso: number): boolean {
    const nombres = this.controlesPaso(paso);
    nombres.forEach(n => this.form.get(n)?.markAsTouched());
    if (nombres.some(n => this.form.get(n)?.invalid)) return false;

    if (paso === 1) {
      const camposPorRol: Record<string, string[]> = {
        refugio: ['nombreRefugio'],
        veterinario: ['tipoNegocioVeterinario', 'nombreDoctor', 'numeroRegistroProfesional', 'modalidadAtencion'],
        servicio: ['tipoServicio', 'nombreNegocio'],
        pyme: ['tipoPyme', 'nombreNegocio'],
      };
      (camposPorRol[this.f.rol.value as string] || []).forEach(n => this.form.get(n)?.markAsTouched());
      const erroresPaso1 = [
        'nombreRefugioRequerido', 'tipoNegocioRequerido', 'nombreDoctorRequerido',
        'numeroRegistroRequerido', 'modalidadRequerida', 'tipoServicioRequerido', 'tipoPymeRequerido', 'nombreNegocioRequerido',
      ];
      if (erroresPaso1.some(e => this.form.hasError(e))) return false;
      if (this.esVeterinarioMedico && !this.tituloFile) {
        this.errorTitulo = 'Sube tu título o certificado profesional.';
        return false;
      }
    }

    return true;
  }

  get esVeterinarioMedico(): boolean {
    if (this.form.get('rol')?.value !== 'veterinario') return false;
    const tipo = this.form.get('tipoNegocioVeterinario')?.value;
    return tipo === 'independiente' || tipo === 'clinica_pequena' || tipo === 'clinica_grande';
  }

  get esClinicaConEquipo(): boolean {
    const tipo = this.form.get('tipoNegocioVeterinario')?.value;
    return tipo === 'clinica_pequena' || tipo === 'clinica_grande';
  }

  get esClinicaGrande(): boolean {
    return this.form.get('tipoNegocioVeterinario')?.value === 'clinica_grande';
  }

  elegirTipoCuenta(rol: Models.Auth.Rol): void {
    this.form.get('rol')?.setValue(rol);
    this.form.patchValue({
      nombreRefugio: '',
      nombreClinica: '',
      tipoNegocioVeterinario: '',
      nombreDoctor: '',
      numeroRegistroProfesional: '',
      especialidadesInput: '',
      modalidadAtencion: '',
      nombreNegocio: '',
      tipoServicio: '',
      tipoPyme: '',
    });
    this.tituloFile = null;
    this.tituloNombre = null;
    this.errorTitulo = null;
  }

  rolExtraValidator(): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const rol = form.get('rol')?.value;
      if (rol === 'refugio' && !form.get('nombreRefugio')?.value?.trim()) {
        return { nombreRefugioRequerido: true };
      }
      if (rol === 'veterinario') {
        const tipo = form.get('tipoNegocioVeterinario')?.value;
        if (!tipo) return { tipoNegocioRequerido: true };
        const esClinica = tipo === 'clinica_pequena' || tipo === 'clinica_grande';
        if (esClinica && !form.get('nombreDoctor')?.value?.trim()) {
          return { nombreDoctorRequerido: true };
        }
        if (!form.get('numeroRegistroProfesional')?.value?.trim()) {
          return { numeroRegistroRequerido: true };
        }
        if (!form.get('modalidadAtencion')?.value) {
          return { modalidadRequerida: true };
        }
      }
      if (rol === 'servicio') {
        if (!form.get('tipoServicio')?.value) {
          return { tipoServicioRequerido: true };
        }
        if (!form.get('nombreNegocio')?.value?.trim()) {
          return { nombreNegocioRequerido: true };
        }
      }
      if (rol === 'pyme') {
        if (!form.get('tipoPyme')?.value) {
          return { tipoPymeRequerido: true };
        }
        if (!form.get('nombreNegocio')?.value?.trim()) {
          return { nombreNegocioRequerido: true };
        }
      }
      return null;
    };
  }

  onTituloSelected(event: any): void {
    const file: File | undefined = event.target.files?.[0];
    this.errorTitulo = null;
    if (!file) return;
    const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!tiposPermitidos.includes(file.type)) {
      this.errorTitulo = 'Solo se permiten imágenes (JPEG, PNG, WebP) o PDF.';
      event.target.value = '';
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      this.errorTitulo = 'El archivo no puede superar los 15 MB.';
      event.target.value = '';
      return;
    }
    this.tituloFile = file;
    this.tituloNombre = file.name;
  }

  quitarTitulo(): void {
    this.tituloFile = null;
    this.tituloNombre = null;
  }

  abrirTerminos(event: Event): void {
    event.preventDefault();
    this.mostrarModalTerminos = true;
  }

  abrirPrivacidad(event: Event): void {
    event.preventDefault();
    this.mostrarModalPrivacidad = true;
  }

  async guardar(): Promise<void> {
    this.cargando = true;
    this.errorGuardado = null;
    if (!this.form.valid) {
      this.form.markAllAsTouched();
      this.cargando = false;
      return;
    }
    if (this.esVeterinarioMedico && !this.tituloFile) {
      this.cargando = false;
      this.errorTitulo = 'Sube tu título o certificado profesional.';
      return;
    }

    try {
      const data = this.form.value;
      const rol = (data.rol as Models.Auth.Rol) || 'usuario';
      const user = this.authenticationService.getCurrentUser()!;
      const fullName = user.displayName || '';
      const parts = fullName.split(' ');
      const nombre = this.security.sanitizeText(parts[0] || '');
      const apellido = this.security.sanitizeText(parts.slice(1).join(' ') || '');

      let tituloUrl: string | undefined;
      if (rol === 'veterinario' && this.tituloFile) {
        tituloUrl = await this.firestoreService.uploadTituloVeterinario(this.uid, this.tituloFile);
      }
      const especialidades = (data.especialidadesInput || '')
        .split(',')
        .map(e => this.security.sanitizeText(e.trim()))
        .filter(Boolean);

      const datosUser: Models.Auth.UserProfile = {
        uid: this.uid,
        nombre,
        apellido,
        telefono: this.security.sanitizeText(data.telefono!),
        region: this.security.sanitizeText(data.region!),
        comuna: this.security.sanitizeText(data.comuna!),
        email: this.security.sanitizeText(user.email || ''),
        foto: this.security.sanitizeText(user.photoURL || ''),
        fotoOrigen: 'google',
        provider: 'google',
        fechaRegistro: new Date().toISOString(),
        rol,
        ...(rol === 'refugio' && data.nombreRefugio?.trim()
          ? { nombreRefugio: this.security.sanitizeText(data.nombreRefugio) }
          : {}),
        ...(rol === 'veterinario' && data.nombreClinica?.trim()
          ? { nombreClinica: this.security.sanitizeText(data.nombreClinica) }
          : {}),
        ...(rol === 'veterinario' ? {
          tipoNegocioVeterinario: data.tipoNegocioVeterinario as Models.Auth.TipoNegocioVeterinario,
          modalidadAtencion: data.modalidadAtencion as Models.Auth.ModalidadAtencion,
          verificado: false,
          ...(this.esClinicaConEquipo && data.nombreDoctor?.trim()
            ? { nombreDoctor: this.security.sanitizeText(data.nombreDoctor) }
            : {}),
          ...(this.esVeterinarioMedico && data.numeroRegistroProfesional?.trim()
            ? { numeroRegistroProfesional: this.security.sanitizeText(data.numeroRegistroProfesional) }
            : {}),
          ...(this.esClinicaGrande && especialidades.length ? { especialidades } : {}),
          ...(tituloUrl ? { tituloUrl } : {}),
        } : {}),
        ...(rol === 'servicio' ? {
          tipoServicio: data.tipoServicio as Models.Auth.TipoServicio,
          ...(data.nombreNegocio?.trim() ? { nombreNegocio: this.security.sanitizeText(data.nombreNegocio) } : {}),
        } : {}),
        ...(rol === 'pyme' ? {
          tipoPyme: data.tipoPyme as Models.Auth.TipoPyme,
          ...(data.nombreNegocio?.trim() ? { nombreNegocio: this.security.sanitizeText(data.nombreNegocio) } : {}),
        } : {}),
        consentGiven: true,
        consentDate: new Date().toISOString(),
        consentVersion: '2.0'
      } as any;

      await this.firestoreService.createDocument(Models.Auth.PathUsers, datosUser, this.uid);
      await this.firestoreService.setPublicContact(this.uid, {
        nombre: datosUser.nombre,
        apellido: datosUser.apellido,
        telefono: datosUser.telefono
      });
      await this.router.navigate(['/bienvenida'], { replaceUrl: true });
    } catch (error) {
      console.error('Error completando perfil', error);
      this.errorGuardado = 'No se pudo guardar tu perfil. Intenta nuevamente.';
    } finally {
      this.cargando = false;
    }
  }
}
