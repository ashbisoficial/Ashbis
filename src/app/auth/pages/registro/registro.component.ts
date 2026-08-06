import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
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
  IonCheckbox
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  eye, eyeOff, closeOutline,
  personOutline, homeOutline, medkitOutline, storefrontOutline, bagHandleOutline,
} from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';
import { TerminosContenidoComponent } from 'src/app/terminos/terminos-contenido.component';
import { PrivacidadContenidoComponent } from 'src/app/privacidad/privacidad-contenido.component';
import { RegionComunaSelectComponent } from 'src/app/shared/components/region-comuna-select/region-comuna-select.component';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
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
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss']
})
export class RegistroComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);

  mostrarPass = false;
  mostrarPass2 = false;
  cargando = false;
  errorRegistro: string | null = null;
  mostrarModalTerminos = false;
  mostrarModalPrivacidad = false;

  nombreRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/;
  telefonoRegex = /^\+569\d{8}$/;
  passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  pwStrength: { percent: number; label: string } | null = null;

  datosForm = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.pattern(this.nombreRegex)]],
      apellido: ['', [Validators.required, Validators.minLength(3), Validators.pattern(this.nombreRegex)]],
      telefono: ['', [Validators.required, Validators.pattern(this.telefonoRegex)]],
      region: ['', Validators.required],
      comuna: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.pattern(this.passwordRegex)]],
      confirmPassword: ['', Validators.required],
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
    { validators: [this.passwordsIgualesValidator(), this.rolExtraValidator()] }
  );

  /** Certificado de título/registro profesional (solo veterinario, tipos con práctica médica). */
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

  readonly tiposCuenta: { valor: Models.Auth.Rol; label: string; icono: string }[] = [
    { valor: 'usuario', label: 'Dueño', icono: 'person-outline' },
    { valor: 'refugio', label: 'Refugio', icono: 'home-outline' },
    { valor: 'veterinario', label: 'Veterinario', icono: 'medkit-outline' },
    { valor: 'servicio', label: 'Servicio', icono: 'storefront-outline' },
    { valor: 'pyme', label: 'Pyme', icono: 'bag-handle-outline' },
  ];

  constructor() {
    addIcons({
      eye, eyeOff, closeOutline,
      personOutline, homeOutline, medkitOutline, storefrontOutline, bagHandleOutline,
    });
  }

  /** true si el rol elegido es veterinario Y el tipo de negocio implica
   *  práctica médica. Antes solo miraba tipoNegocioVeterinario: si alguien
   *  elegía "Veterinario", tipeaba el tipo de cuenta y después volvía a
   *  "Dueño" sin que ese campo se limpiara, el formulario quedaba pidiendo
   *  un título que ya no correspondía — sin mostrar ningún error, porque el
   *  mensaje vive dentro del bloque que solo se ve con rol veterinario. */
  get esVeterinarioMedico(): boolean {
    if (this.datosForm.get('rol')?.value !== 'veterinario') return false;
    const tipo = this.datosForm.get('tipoNegocioVeterinario')?.value;
    return tipo === 'independiente' || tipo === 'clinica_pequena' || tipo === 'clinica_grande';
  }

  /** true si el tipo de negocio es una clínica con equipo (no un independiente). */
  get esClinicaConEquipo(): boolean {
    const tipo = this.datosForm.get('tipoNegocioVeterinario')?.value;
    return tipo === 'clinica_pequena' || tipo === 'clinica_grande';
  }

  get esClinicaGrande(): boolean {
    return this.datosForm.get('tipoNegocioVeterinario')?.value === 'clinica_grande';
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

  get f() {
    return this.datosForm.controls;
  }

  // ── Registro en pasos ────────────────────────────────────────────────────
  // Mismo FormGroup de siempre, solo se muestra un paso a la vez. El paso 1
  // ("Datos del rol") se salta para 'usuario', que no tiene campos propios.
  readonly ULTIMO_PASO = 3;
  pasoActual = 0;

  private readonly titulosPaso: Record<number, string> = {
    0: 'Tipo de cuenta',
    1: 'Datos de tu cuenta',
    2: 'Datos personales',
    3: 'Credenciales',
  };

  get tituloPasoActual(): string {
    return this.titulosPaso[this.pasoActual] || '';
  }

  get pasosVisibles(): number[] {
    const base = [0, 1, 2, 3];
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

  /** Controles con Validators propios que viven en cada paso — los campos
   *  de "Datos del rol" (paso 1) no tienen Validators individuales, se
   *  validan solo a través de los errores de rolExtraValidator (ver abajo). */
  private controlesPaso(paso: number): string[] {
    switch (paso) {
      case 2: return ['nombre', 'apellido', 'telefono', 'region', 'comuna'];
      case 3: return ['email', 'password', 'confirmPassword', 'consentimiento'];
      default: return [];
    }
  }

  private validarPaso(paso: number): boolean {
    const nombres = this.controlesPaso(paso);
    nombres.forEach(n => this.datosForm.get(n)?.markAsTouched());
    if (nombres.some(n => this.datosForm.get(n)?.invalid)) return false;

    if (paso === 1) {
      const camposPorRol: Record<string, string[]> = {
        refugio: ['nombreRefugio'],
        veterinario: ['tipoNegocioVeterinario', 'nombreDoctor', 'numeroRegistroProfesional', 'modalidadAtencion'],
        servicio: ['tipoServicio', 'nombreNegocio'],
        pyme: ['tipoPyme', 'nombreNegocio'],
      };
      (camposPorRol[this.f.rol.value as string] || []).forEach(n => this.datosForm.get(n)?.markAsTouched());
      const erroresPaso1 = [
        'nombreRefugioRequerido', 'tipoNegocioRequerido', 'nombreDoctorRequerido',
        'numeroRegistroRequerido', 'modalidadRequerida', 'tipoServicioRequerido', 'tipoPymeRequerido', 'nombreNegocioRequerido',
      ];
      if (erroresPaso1.some(e => this.datosForm.hasError(e))) return false;
      if (this.esVeterinarioMedico && !this.tituloFile) {
        this.errorTitulo = 'Sube tu título o certificado profesional.';
        return false;
      }
    }

    if (paso === 3 && this.datosForm.hasError('passwordMismatch')) return false;

    return true;
  }

  abrirTerminos(event: Event): void {
    event.preventDefault();
    this.mostrarModalTerminos = true;
  }

  abrirPrivacidad(event: Event): void {
    event.preventDefault();
    this.mostrarModalPrivacidad = true;
  }

  elegirTipoCuenta(rol: Models.Auth.Rol): void {
    this.datosForm.get('rol')?.setValue(rol);
    // Limpia los campos específicos de los otros roles: si quedaban con
    // valor, seguían activando validaciones de un rol que ya no está
    // elegido (ver comentario en esVeterinarioMedico).
    this.datosForm.patchValue({
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

  passwordsIgualesValidator(): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const pass = form.get('password')?.value;
      const confirm = form.get('confirmPassword')?.value;
      return pass === confirm ? null : { passwordMismatch: true };
    };
  }

  rolExtraValidator(): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const rol = form.get('rol')?.value;
      const nombreRefugio = form.get('nombreRefugio')?.value;
      if (rol === 'refugio' && !nombreRefugio?.trim()) {
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

  onPasswordInput(): void {
    const pass = this.datosForm.get('password')?.value || '';
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[a-z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[\W_]/.test(pass)) strength++;

    const labels = ['Muy debil', 'Debil', 'Regular', 'Fuerte', 'Muy fuerte'];
    this.pwStrength = { percent: (strength / 5) * 100, label: labels[strength - 1] || '' };
  }

  async registrarse(): Promise<void> {
    this.cargando = true;
    this.errorRegistro = null;
    if (!this.datosForm.valid) {
      this.cargando = false;
      return;
    }
    if (this.esVeterinarioMedico && !this.tituloFile) {
      this.cargando = false;
      this.errorTitulo = 'Sube tu título o certificado profesional.';
      return;
    }

    try {
      const data = this.datosForm.value;
      const cleanEmail = this.security.sanitizeText(data.email!);
      const respuesta = await this.authenticationService.createUser(cleanEmail, data.password!);
      const rol = (data.rol as Models.Auth.Rol) || 'usuario';

      let tituloUrl: string | undefined;
      if (rol === 'veterinario' && this.tituloFile) {
        tituloUrl = await this.firestoreService.uploadTituloVeterinario(respuesta.user.uid, this.tituloFile);
      }
      const especialidades = (data.especialidadesInput || '')
        .split(',')
        .map(e => this.security.sanitizeText(e.trim()))
        .filter(Boolean);

      const datosUser: Models.Auth.UserProfile = {
        uid: respuesta.user.uid,
        nombre: this.security.sanitizeText(data.nombre!),
        apellido: this.security.sanitizeText(data.apellido!),
        telefono: this.security.sanitizeText(data.telefono!),
        region: this.security.sanitizeText(data.region!),
        comuna: this.security.sanitizeText(data.comuna!),
        email: cleanEmail,
        provider: 'password',
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

      await this.firestoreService.createDocument(Models.Auth.PathUsers, datosUser, respuesta.user.uid);
      await this.firestoreService.setPublicContact(respuesta.user.uid, {
        nombre: datosUser.nombre,
        apellido: datosUser.apellido,
        telefono: datosUser.telefono
      });
      // El usuario ya queda autenticado tras createUserWithEmailAndPassword,
      // así que navegamos directo a bienvenida (no a /login, que lo rebotaría
      // por publicGuard) — ahí se preguntan tema/tamaño de letra/permisos
      // antes de entrar a /tabs/home.
      await this.router.navigate(['/bienvenida'], { replaceUrl: true });
    } catch (error: any) {
      console.error('Error registrando', error);
      if (error?.code === 'auth/email-already-in-use') {
        this.errorRegistro = 'Ese correo ya está registrado. Intenta iniciar sesión.';
      } else if (error?.code === 'auth/weak-password') {
        this.errorRegistro = 'La contraseña es demasiado débil.';
      } else {
        this.errorRegistro = 'No se pudo completar el registro. Intenta nuevamente.';
      }
    } finally {
      this.cargando = false;
    }
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }
}