import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, AfterViewInit, OnDestroy, OnInit, ViewChild } from '@angular/core';
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
import { environment } from 'src/environments/environment';
import type { User, UserCredential } from 'firebase/auth';

// El script de Google Identity Services (cargado en index.html) define este
// objeto global; no hay un paquete de tipos oficial liviano para él, así que
// lo tratamos como `any` y nos apoyamos en los nombres de la documentación de Google.
declare const google: any;

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
export class LoginComponent implements OnInit, AfterViewInit, OnDestroy {
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
  googleNoDisponible = false;

  // En la app Android (Capacitor) el botón web de Google Identity Services no
  // funciona dentro del WebView, así que usamos el plugin nativo en su lugar.
  readonly esNativo = this.authenticationService.isNativePlatform();

  @ViewChild('googleBtn') private googleBtnRef?: ElementRef<HTMLDivElement>;
  private googleBotonRenderizado = false;
  private googleRetryTimeoutId?: ReturnType<typeof setTimeout>;

  constructor() {
    addIcons({ eye, eyeOff, logoGoogle });
  }

  ngOnInit(): void {
    this.datosForm = this.fb.group({
      email: this.fb.nonNullable.control('', [Validators.required, Validators.email]),
      password: this.fb.nonNullable.control('', [Validators.required, Validators.minLength(6)])
    });

    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        if (user) this.router.navigate(['tabs/home'], { replaceUrl: true });
      });
  }

  ngAfterViewInit(): void {
    if (!this.esNativo) this.inicializarBotonGoogle();
  }

  // 🔵 Dibuja el botón oficial de Google (Google Identity Services) en vez de
  // usar signInWithPopup/signInWithRedirect de Firebase. Esto evita el
  // auth/internal-error que ocurre en Chrome cuando las cookies de terceros
  // están bloqueadas: GIS usa su propio mecanismo (FedCM cuando está
  // disponible) en vez de depender del iframe puente de Firebase.
  // Reintenta unas cuantas veces por si el script de Google (cargado en
  // index.html) todavía no terminó de descargarse.
  private inicializarBotonGoogle(intentos = 0): void {
    if (this.googleBotonRenderizado) return;

    if (typeof google === 'undefined' || !google?.accounts?.id || !this.googleBtnRef) {
      if (intentos < 20) {
        this.googleRetryTimeoutId = setTimeout(() => this.inicializarBotonGoogle(intentos + 1), 150);
      } else {
        console.warn('No se pudo cargar Google Identity Services (script bloqueado o sin red).');
        this.googleNoDisponible = true;
      }
      return;
    }

    google.accounts.id.initialize({
      client_id: environment.googleWebClientId,
      callback: (response: { credential: string }) => this.onGoogleCredential(response)
    });

    google.accounts.id.renderButton(this.googleBtnRef.nativeElement, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      shape: 'pill',
      text: 'continue_with',
      logo_alignment: 'left',
      width: 360
    });

    this.googleBotonRenderizado = true;
  }

  // 🔵 Google nos entrega un ID token (JWT) ya validado; lo intercambiamos
  // por una sesión de Firebase Auth con signInWithCredential.
  private async onGoogleCredential(response: { credential: string }): Promise<void> {
    this.loginError = null;
    this.cargando = true;
    try {
      const cred = await this.authenticationService.signInWithGoogleIdToken(response.credential);
      await this.finalizarLoginGoogle(cred);
    } catch (error: any) {
      this.manejarErrorGoogle(error, 'GIS');
    } finally {
      this.cargando = false;
    }
  }

  // 🔵 LOGIN GOOGLE (NATIVO) — invocado desde el botón nativo que se muestra
  // solo dentro de la app Android/Capacitor (ver `esNativo` y el template).
  async loginConGoogleNativo(): Promise<void> {
    this.loginError = null;
    this.cargando = true;
    try {
      const cred = await this.authenticationService.signInWithGoogleNative();
      await this.finalizarLoginGoogle(cred);
    } catch (error: any) {
      this.manejarErrorGoogle(error, 'NATIVO');
    } finally {
      this.cargando = false;
    }
  }

  private async finalizarLoginGoogle(cred: UserCredential): Promise<void> {
    await this.sincronizarPerfilGoogle(cred.user);
    this.router.navigate(['tabs/home'], { replaceUrl: true });
  }

  private manejarErrorGoogle(error: any, origen: 'GIS' | 'NATIVO'): void {
    console.error('================================');
    console.error(`ERROR GOOGLE LOGIN (${origen})`);
    console.error('CODE:', error?.code);
    console.error('MESSAGE:', error?.message);
    console.error('FULL ERROR:', error);
    console.error('================================');

    this.loginError =
      `${error?.code || 'sin-codigo'} - ${error?.message || 'sin-mensaje'}`;
  }

  // Crea o actualiza el documento de perfil en Firestore tras un login con Google.
  private async sincronizarPerfilGoogle(user: User): Promise<void> {
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
      fotoOrigen: 'google' as const,
      provider: 'google',
      fechaRegistro: new Date().toISOString()
    };

    const userExistente = await this.firestoreService.getDocument(`usuarios/${user.uid}`);
    if (!userExistente) {
      await this.firestoreService.createDocument('usuarios', datosUser, user.uid);
    } else {
      const actualizacion: any = { nombre, apellido };
      // Si el usuario ya eligió una foto propia, no la pisamos con la de Google en cada login.
      if ((userExistente as any)?.fotoOrigen !== 'custom') {
        actualizacion.foto = this.security.sanitizeText(user.photoURL || '');
        actualizacion.fotoOrigen = 'google';
      }
      await this.firestoreService.updateDocument(`usuarios/${user.uid}`, actualizacion);
    }

    // El teléfono de Google Auth casi siempre viene vacío; si el usuario ya
    // tenía uno guardado en su perfil, lo conservamos en la copia pública.
    const telefonoActual = userExistente ? ((userExistente as any)?.telefono ?? '') : datosUser.telefono;
    await this.firestoreService.setPublicContact(user.uid, { nombre, apellido, telefono: telefonoActual });
  }

  ngOnDestroy(): void {
    if (this.googleRetryTimeoutId) clearTimeout(this.googleRetryTimeoutId);
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

  irARegistro(): void {
    this.router.navigate(['/registro'], { replaceUrl: true });
  }

  irARecuperarPassword(): void {
    this.router.navigate(['/forgot-password']);
  }
}