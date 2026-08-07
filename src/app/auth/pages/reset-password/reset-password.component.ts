import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonSpinner,
  IonText,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { eye, eyeOff } from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';

@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  standalone: true,
  styleUrls: ['./reset-password.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonNote,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
    IonIcon,
  ],
})
export class ResetPasswordComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthenticationService);
  private readonly fb = inject(FormBuilder);

  /** Mismo criterio que el registro: mínimo 8 caracteres, mayúscula,
   *  minúscula, número y símbolo. */
  passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/;

  /** 'validando' mientras se verifica el oobCode contra Firebase;
   *  'valido' si ya se puede mostrar el formulario; 'invalido' si el link
   *  venció, ya se usó, o directamente no trae un oobCode. */
  estado: 'validando' | 'valido' | 'invalido' = 'validando';
  email: string | null = null;
  private oobCode = '';

  mostrarPass = false;
  mostrarPass2 = false;
  guardando = false;
  errorGuardar: string | null = null;
  completado = false;
  pwStrength: { percent: number; label: string } | null = null;

  form = this.fb.group(
    {
      password: ['', [Validators.required, Validators.pattern(this.passwordRegex)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: [this.passwordsIgualesValidator()] }
  );

  constructor() {
    addIcons({ eye, eyeOff });
  }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const mode = params.get('mode');
    const oobCode = params.get('oobCode');
    if (mode !== 'resetPassword' || !oobCode) {
      this.estado = 'invalido';
      return;
    }
    this.oobCode = oobCode;

    try {
      this.email = await this.auth.verificarCodigoReset(oobCode);
      this.estado = 'valido';
    } catch {
      this.estado = 'invalido';
    }
  }

  private passwordsIgualesValidator(): ValidatorFn {
    return (form) => {
      const pass = form.get('password')?.value;
      const confirm = form.get('confirmPassword')?.value;
      return pass === confirm ? null : { passwordMismatch: true };
    };
  }

  get f() {
    return this.form.controls;
  }

  onPasswordInput(): void {
    const pass = this.form.get('password')?.value || '';
    let strength = 0;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[a-z]/.test(pass)) strength++;
    if (/\d/.test(pass)) strength++;
    if (/[\W_]/.test(pass)) strength++;

    const labels = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte'];
    this.pwStrength = { percent: (strength / 5) * 100, label: labels[strength - 1] || '' };
  }

  async guardar(): Promise<void> {
    this.form.markAllAsTouched();
    this.errorGuardar = null;
    if (this.form.invalid || this.guardando) return;

    this.guardando = true;
    try {
      await this.auth.confirmarNuevaContrasena(this.oobCode, this.form.value.password!);
      this.completado = true;
      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch (error: any) {
      if (error?.code === 'auth/expired-action-code' || error?.code === 'auth/invalid-action-code') {
        this.estado = 'invalido';
      } else if (error?.code === 'auth/weak-password') {
        this.errorGuardar = 'La contraseña es demasiado débil.';
      } else {
        this.errorGuardar = 'No se pudo cambiar la contraseña. Intenta nuevamente.';
      }
    } finally {
      this.guardando = false;
    }
  }

  irARecuperar(): void {
    this.router.navigate(['/forgot-password']);
  }

  irALogin(): void {
    this.router.navigate(['/login']);
  }
}
