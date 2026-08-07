import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
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
  IonInput,
  IonItem,
  IonLabel,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { SecurityService } from 'src/app/services/security.service';

@Component({
  selector: 'app-forgot-password',
  templateUrl: './forgot-password.component.html',
  standalone: true,
  styleUrls: ['./forgot-password.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonText,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle
  ]
})
export class ForgotPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authenticationService = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);

  emailForm!: FormGroup;
  cargando = false;
  errorMessage: string | null = null;
  successMessage: string | null = null;

  ngOnInit(): void {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  get email() {
    return this.emailForm.get('email');
  }

  async enviarRecuperacion(): Promise<void> {
    this.emailForm.markAllAsTouched();
    this.errorMessage = null;
    this.successMessage = null;
    if (this.emailForm.invalid) return;

    const email = this.security.sanitizeText(this.emailForm.value.email);
    this.cargando = true;

    try {
      await this.authenticationService.resetPassword(email);
      this.successMessage = 'Si el correo existe, recibirás instrucciones de recuperación.';
      this.emailForm.reset();
      setTimeout(() => this.router.navigate(['/login']), 3000);
    } catch (err) {
      console.error(err);
      this.errorMessage = 'Si el correo existe, recibirás instrucciones de recuperación.';
    } finally {
      this.cargando = false;
    }
  }

  volverAlLogin(): void {
    this.router.navigate(['/login']);
  }
}
