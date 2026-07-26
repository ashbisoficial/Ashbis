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
import { eye, eyeOff, closeOutline } from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';
import { TerminosContenidoComponent } from 'src/app/terminos/terminos-contenido.component';
import { PrivacidadContenidoComponent } from 'src/app/privacidad/privacidad-contenido.component';

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
    TerminosContenidoComponent,
    PrivacidadContenidoComponent
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
      direccion: ['', [Validators.required, Validators.minLength(10)]],
      region: ['', Validators.required],
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
  ];

  constructor() {
    addIcons({ eye, eyeOff, closeOutline });
  }

  /** true si el tipo de negocio implica práctica médica (no la peluquería). */
  get esVeterinarioMedico(): boolean {
    const tipo = this.datosForm.get('tipoNegocioVeterinario')?.value;
    return tipo === 'independiente' || tipo === 'clinica_pequena' || tipo === 'clinica_grande';
  }

  /** true si el tipo de negocio es una clínica con equipo (no un independiente ni una peluquería). */
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
        direccion: this.security.sanitizeText(data.direccion!),
        region: this.security.sanitizeText(data.region!),
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
      // así que navegamos directo a home (no a /login, que lo rebotaría por publicGuard).
      await this.router.navigate(['/tabs/home'], { replaceUrl: true });
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