import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonImg,
  IonInput,
  IonItem,
  IonLabel,
  IonText,
  IonThumbnail
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eye, eyeOff, logoGoogle } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { SecurityService } from 'src/app/services/security.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  standalone: true,
  styleUrls: ['./login.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    IonThumbnail,
    IonImg
  ]
})
export class LoginComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly firestoreService = inject(FirestoreService);
  private readonly security = inject(SecurityService);
  private readonly destroy$ = new Subject<void>();

  datosForm!: FormGroup<{
    email: FormControl<string>;
    password: FormControl<string>;
  }>;

  cargando = false;
  showPass = false;
  loginError: string | null = null;

  constructor() {
    addIcons({ eye, eyeOff, logoGoogle });
  }

  ngOnInit(): void {
    this.datosForm = this.fb.group({
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(6)])
    });

    // Si venimos de un redirect de Google, procesamos antes de dejar
    // que la suscripción de authState dispare la navegación por su cuenta.
    this.procesarRedirectGoogle().finally(() => {
      this.authenticationService.authState$
        .pipe(takeUntil(this.destroy$))
        .subscribe((user) => {
          if (user) this.router.navigate(['tabs/home'], { replaceUrl: true });
        });
    });
  }

  private async procesarRedirectGoogle(): Promise<void> {
    try {
      const cred = await this.authenticationService.getGoogleRedirectResult();
      if (!cred?.user) return; // No venimos de un redirect de Google

      const user = cred.user;
      const fullName = user.displayName || '';
      const parts = fullName.split(' ');
      const nombre = this.security.sanitizeText(parts[0] || '');
      const apellido = this.security.sanitizeText(parts.slice(1).join(' ') || '');

      const datosUser = {
        uid: user.uid,
        nombre,
        apellido,
        email: this.security.sanitizeText(user.email || ''),
        telefono: this.security.sanitizeText(user.phoneNumber || ''),
        foto: this.security.sanitizeText(user.photoURL || ''),
        provider: 'google'
      };

      const userExistente = await this.firestoreService.getDocument(`usuarios/${user.uid}`);
      if (!userExistente) {
        await this.firestoreService.createDocument('usuarios', datosUser, user.uid);
      } else {
        await this.firestoreService.updateDocument(`usuarios/${user.uid}`, {
          nombre,
          apellido,
          foto: this.security.sanitizeText(user.photoURL || '')
        });
      }

      this.router.navigate(['tabs/home'], { replaceUrl: true });
    } catch (error: any) {
      console.error('================================');
      console.error('ERROR GOOGLE LOGIN (redirect)');
      console.error('CODE:', error?.code);
      console.error('MESSAGE:', error?.message);
      console.error('FULL ERROR:', error);
      console.error('================================');

      this.loginError =
        `${error?.code || 'sin-codigo'} - ${error?.message || 'sin-mensaje'}`;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get email(): FormControl<string> {
    return this.datosForm.controls.email;
  }

  get password(): FormControl<string> {
    return this.datosForm.controls.password;
  }

  async login(): Promise<void> {
    this.datosForm.markAllAsTouched();
    this.loginError = null;
    if (this.datosForm.invalid) return;

    const email = this.security.sanitizeText(this.email.value);
    const password = this.password.value;
    if (!this.security.canAttemptLogin(email)) {
      this.loginError = 'Demasiados intentos. Espera 15 minutos e intenta nuevamente.';
      return;
    }

    this.cargando = true;
    try {
      await this.authenticationService.login(email, password);
      this.security.resetLoginAttempts(email);
      this.router.navigate(['tabs/home'], { replaceUrl: true });
    } catch (err) {
      console.error(err);
      this.loginError = 'Credenciales incorrectas.';
    } finally {
      this.cargando = false;
    }
  }

  async loginGoogle(): Promise<void> {
    this.loginError = null;
    this.cargando = true;
    try {
      // Esto redirige la página a Google; el resultado se procesa
      // en procesarRedirectGoogle() cuando el usuario vuelve.
      await this.authenticationService.loginWithGoogle();
    } catch (error: any) {
      console.error('================================');
      console.error('ERROR GOOGLE LOGIN');
      console.error('CODE:', error?.code);
      console.error('MESSAGE:', error?.message);
      console.error('FULL ERROR:', error);
      console.error('================================');

      this.loginError =
        `${error?.code || 'sin-codigo'} - ${error?.message || 'sin-mensaje'}`;
      this.cargando = false;
    }
  }

  irARegistro(): void {
    this.router.navigate(['/registro'], { replaceUrl: true });
  }

  irARecuperarPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}