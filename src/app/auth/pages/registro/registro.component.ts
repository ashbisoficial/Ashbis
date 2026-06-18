import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
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
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonIcon,
  IonImg,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonThumbnail
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';

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
    IonIcon,
    IonImg,
    IonNote,
    IonSpinner,
    IonThumbnail
  ],
  templateUrl: './registro.component.html',
  styleUrls: ['./registro.component.scss']
})
export class RegistroComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);

  mostrarPass = false;
  mostrarPass2 = false;
  cargando = false;
  errorRegistro: string | null = null;

  nombreRegex = /^[A-Za-zÁÉÍÓÚÑáéíóúñ\s]+$/;
  telefonoRegex = /^\+569\d{8}$/;
  gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
  passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  pwStrength: { percent: number; label: string } | null = null;

  datosForm = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(3), Validators.pattern(this.nombreRegex)]],
      apellido: ['', [Validators.required, Validators.minLength(3), Validators.pattern(this.nombreRegex)]],
      telefono: ['', [Validators.required, Validators.pattern(this.telefonoRegex)]],
      direccion: ['', [Validators.required, Validators.minLength(10)]],
      region: ['', Validators.required],
      email: ['', [Validators.required, Validators.pattern(this.gmailRegex)]],
      password: ['', [Validators.required, Validators.pattern(this.passwordRegex)]],
      confirmPassword: ['', Validators.required]
    },
    { validators: this.passwordsIgualesValidator() }
  );

  constructor() {
    addIcons({ eye, eyeOff });
  }

  ngOnInit(): void {}

  get f() {
    return this.datosForm.controls;
  }

  passwordsIgualesValidator(): ValidatorFn {
    return (form: AbstractControl): ValidationErrors | null => {
      const pass = form.get('password')?.value;
      const confirm = form.get('confirmPassword')?.value;
      return pass === confirm ? null : { passwordMismatch: true };
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

    try {
      const data = this.datosForm.value;
      const cleanEmail = this.security.sanitizeText(data.email!);
      const respuesta = await this.authenticationService.createUser(cleanEmail, data.password!);
      const datosUser: Models.Auth.UserProfile = {
        uid: respuesta.user.uid,
        nombre: this.security.sanitizeText(data.nombre!),
        apellido: this.security.sanitizeText(data.apellido!),
        telefono: this.security.sanitizeText(data.telefono!),
        direccion: this.security.sanitizeText(data.direccion!),
        region: this.security.sanitizeText(data.region!),
        email: cleanEmail
      };

      await this.firestoreService.createDocument(Models.Auth.PathUsers, datosUser, respuesta.user.uid);
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