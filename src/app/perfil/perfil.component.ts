import { DatePipe, NgIf, NgFor } from '@angular/common';
import { Component, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonBadge,
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
  IonInput,
  IonItem,
  IonLabel,
  IonNote,
  IonRow,
  IonSelect,
  IonSelectOption,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cameraOutline, createOutline, logoGoogle, closeOutline, trashOutline,
  checkmarkOutline, logOutOutline, personCircleOutline, alertCircleOutline,
  personOutline, mailOutline, callOutline, calendarOutline, locationOutline,
  documentTextOutline, refreshOutline, addOutline, medkitOutline, settingsOutline
} from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';
import { PushNotificationService } from '../services/push-notification.service';

interface UsuarioActual {
  uid: string;
  email: string | null;
  name: string | null;
  photoURL: string | null;
  providerId: string | null;
}

@Component({
  selector: 'app-perfil',
  standalone: true,
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.scss'],
  imports: [
    NgIf,
    NgFor,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSkeletonText,
    IonItem,
    IonLabel,
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonSpinner,
    IonBadge,
    IonNote
  ],
  providers: [DatePipe]
})
export class PerfilComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly pushNotifications = inject(PushNotificationService);
  private readonly security = inject(SecurityService);

  authenticationService: AuthenticationService = inject(AuthenticationService);
  firestoreService: FirestoreService = inject(FirestoreService);
  toastCtrl = inject(ToastController);
  loadingCtrl = inject(LoadingController);
  fb = inject(FormBuilder);

  user: UsuarioActual | null = null;
  user_profile: Models.Auth.UserProfile | undefined;
  private readonly datePipe = inject(DatePipe);

  cargando = true;
  cargaFallida = false;
  editMode = false;
  subiendoFoto = false;
  guardando = false;

  transferenciasPendientes: Models.Transferencias.Transferencia[] = [];
  transferenciasEnviadas: Models.Transferencias.Transferencia[] = [];

  invitacionesEquipoPendientes: Models.Equipo.InvitacionEquipo[] = [];
  invitacionesEquipoEnviadas: Models.Equipo.InvitacionEquipo[] = [];
  miembrosEquipo: Models.Equipo.MiembroEquipo[] = [];
  refugiosEnLosQueColaboro: string[] = [];
  nombresRefugios: Record<string, string> = {};

  /** Vista previa local mientras se sube una foto nueva (antes de que Firestore confirme el cambio) */
  fotoPreview: string | null = null;

  @ViewChild('fotoInput') private fotoInputRef?: ElementRef<HTMLInputElement>;

  readonly defaultPhoto = 'assets/img/foto_avatar.jpg';
  readonly maxDescripcionLen = 300;
  readonly maxContactos = 2;

  private readonly nombreRegex = /^[A-Za-zÁÉÍÓÚÑÜáéíóúñü\s'-]+$/;
  private readonly telefonoRegex = /^[+\d\s\-()]{6,20}$/;

  profileForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60), Validators.pattern(this.nombreRegex)]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60), Validators.pattern(this.nombreRegex)]],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    telefono: ['', [Validators.pattern(this.telefonoRegex)]],
    fechaNacimiento: ['', [this.validarFechaNoFutura()]],
    region: ['', [Validators.maxLength(60)]],
    comuna: ['', [Validators.maxLength(60)]],
    direccion: ['', [Validators.minLength(5), Validators.maxLength(150)]],
    descripcion: ['', [Validators.maxLength(this.maxDescripcionLen)]],
    contactosEmergencia: this.fb.array<FormGroup>([])
  });

  get contactosArray(): FormArray {
    return this.profileForm.get('contactosEmergencia') as FormArray;
  }

  private crearContactoGroup(nombre = '', telefono = ''): FormGroup {
    return this.fb.group({
      nombre: [nombre, [Validators.required, Validators.minLength(2), Validators.maxLength(60), Validators.pattern(this.nombreRegex)]],
      telefono: [telefono, [Validators.required, Validators.pattern(this.telefonoRegex)]]
    });
  }

  agregarContacto(): void {
    if (this.contactosArray.length >= this.maxContactos) return;
    this.contactosArray.push(this.crearContactoGroup());
  }

  quitarContacto(index: number): void {
    this.contactosArray.removeAt(index);
  }

  /** Mensaje de error legible para un campo de un contacto de emergencia. */
  getContactoError(index: number, campo: 'nombre' | 'telefono'): string | null {
    const control = this.contactosArray.at(index)?.get(campo);
    if (!control || !control.touched || control.valid) return null;
    const errors = control.errors;
    if (!errors) return null;

    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['pattern']) {
      return campo === 'telefono' ? 'Formato de teléfono inválido. Ej: +56 9 1234 5678' : 'Solo se permiten letras y espacios.';
    }
    return 'Valor inválido.';
  }

  constructor() {
    addIcons({
      cameraOutline, createOutline, logoGoogle, closeOutline,
      checkmarkOutline, logOutOutline, personCircleOutline, alertCircleOutline,
      personOutline, mailOutline, callOutline, calendarOutline, locationOutline,
      documentTextOutline, refreshOutline, trashOutline, addOutline, medkitOutline,
      settingsOutline
    });

    this.cargando = true;
    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        if (res) {
          this.user = {
            uid: res.uid,
            email: res.email,
            name: res.displayName,
            photoURL: res.photoURL,
            providerId: res.providerData?.[0]?.providerId ?? null
          };
          this.getDatosProfile(res.uid);
          this.cargarTransferencias(res.uid, res.email);
          this.cargarEquipo(res.uid, res.email);
        } else {
          this.user = null;
          this.user_profile = undefined;
          this.transferenciasPendientes = [];
          this.transferenciasEnviadas = [];
          this.invitacionesEquipoPendientes = [];
          this.invitacionesEquipoEnviadas = [];
          this.miembrosEquipo = [];
          this.refugiosEnLosQueColaboro = [];
          this.cargando = false;
        }
      });
  }

  private cargarTransferencias(uid: string, email: string | null): void {
    if (email) {
      this.firestoreService.getTransferenciasPendientesParaMi(email)
        .pipe(takeUntil(this.destroy$))
        .subscribe(t => this.transferenciasPendientes = t);
    }
    // Solo relevante para refugios, pero es barato pedirlo siempre y
    // mostrarlo condicionado en la plantilla al rol.
    this.firestoreService.getTransferenciasEnviadas(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => this.transferenciasEnviadas = t.filter(tr => tr.estado === 'pendiente'));
  }

  private cargarEquipo(uid: string, email: string | null): void {
    if (email) {
      this.firestoreService.getInvitacionesEquipoPendientesParaMi(email)
        .pipe(takeUntil(this.destroy$))
        .subscribe(inv => this.invitacionesEquipoPendientes = inv);
    }
    // Mi propio equipo (si soy refugio): invitaciones enviadas + miembros.
    this.firestoreService.getInvitacionesEquipoEnviadas(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(inv => this.invitacionesEquipoEnviadas = inv.filter(i => i.estado === 'pendiente'));
    this.firestoreService.getMiembrosEquipo(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(m => this.miembrosEquipo = m);
    // Equipos de refugios ajenos de los que formo parte.
    this.firestoreService.getMisRefugios(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(refugios => {
        this.refugiosEnLosQueColaboro = refugios;
        refugios.forEach(refugioUid => {
          if (this.nombresRefugios[refugioUid]) return;
          this.firestoreService.getDocument(`usuarios/${refugioUid}`).then(perfil => {
            this.nombresRefugios[refugioUid] = perfil?.nombreRefugio?.trim() || 'Refugio';
          });
        });
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Carga de datos ───────────────────────────────────────────────────────
  getDatosProfile(uid: string): void {
    this.cargaFallida = false;
    this.firestoreService
      .getDocumentChanges<Models.Auth.UserProfile>(`${Models.Auth.PathUsers}/${uid}`)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (res) {
            this.user_profile = res;
            this.fotoPreview = null; // la foto definitiva ya llegó vía Firestore
            if (!this.editMode) {
              this.patchFormDesdePerfil(res);
            }
          } else {
            // Caso borde: el usuario está autenticado pero no tiene documento
            // de perfil en Firestore (cuenta corrupta o creada a medias).
            this.user_profile = undefined;
            this.cargaFallida = true;
          }
          this.cargando = false;
        },
        error: (err) => {
          console.error('Error cargando el perfil', err);
          this.cargando = false;
          this.cargaFallida = true;
        }
      });
  }

  private patchFormDesdePerfil(perfil: Models.Auth.UserProfile): void {
    this.profileForm.patchValue({
      nombre: perfil.nombre ?? '',
      apellido: perfil.apellido ?? '',
      email: perfil.email ?? this.user?.email ?? '',
      telefono: perfil.telefono ?? '',
      fechaNacimiento: perfil.fechaNacimiento ?? '',
      region: perfil.region ?? '',
      comuna: perfil.comuna ?? '',
      direccion: perfil.direccion ?? '',
      descripcion: perfil.descripcion ?? ''
    });

    this.contactosArray.clear();
    (perfil.contactosEmergencia ?? []).slice(0, this.maxContactos).forEach(c => {
      this.contactosArray.push(this.crearContactoGroup(c.nombre, c.telefono));
    });
  }

  reintentarCarga(): void {
    if (this.user?.uid) {
      this.cargando = true;
      this.getDatosProfile(this.user.uid);
    }
  }

  // ── Helpers de plantilla ─────────────────────────────────────────────────
  get fotoActual(): string {
    return this.fotoPreview || this.user_profile?.foto || this.defaultPhoto;
  }

  get esCuentaGoogle(): boolean {
    return this.user_profile?.provider === 'google' || this.user?.providerId === 'google.com';
  }

  get puedeUsarFotoDeGoogle(): boolean {
    return this.esCuentaGoogle &&
      this.user_profile?.fotoOrigen === 'custom' &&
      !!this.user?.photoURL;
  }

  get descripcionLength(): number {
    return (this.profileForm.get('descripcion')?.value ?? '').length;
  }

  get miembroDesde(): string | null {
    const fecha = this.user_profile?.fechaRegistro;
    if (!fecha) return null;
    return this.datePipe.transform(fecha, 'MMMM yyyy', undefined, 'es-CL');
  }

  /** Abre el selector de archivos nativo (oculto) para elegir una foto nueva. */
  abrirSelectorFoto(): void {
    if (this.subiendoFoto) return;
    this.fotoInputRef?.nativeElement.click();
  }

  /** Mensaje de error legible para un campo del formulario, o null si no hay error que mostrar. */
  getError(campo: string): string | null {
    const control = this.profileForm.get(campo);
    if (!control || !control.touched || control.valid) return null;
    const errors = control.errors;
    if (!errors) return null;

    if (errors['required']) return 'Este campo es obligatorio.';
    if (errors['minlength']) return `Mínimo ${errors['minlength'].requiredLength} caracteres.`;
    if (errors['maxlength']) return `Máximo ${errors['maxlength'].requiredLength} caracteres.`;
    if (errors['email']) return 'Ingresa un correo válido.';
    if (errors['fechaFutura']) return 'La fecha no puede ser futura.';
    if (errors['pattern']) {
      if (campo === 'telefono') return 'Formato de teléfono inválido. Ej: +56 9 1234 5678';
      return 'Solo se permiten letras y espacios.';
    }
    return 'Valor inválido.';
  }

  // ── Edición ───────────────────────────────────────────────────────────────
  habilitarEdicion(): void {
    this.editMode = true;
  }

  cancelarEdicion(): void {
    this.editMode = false;
    if (this.user_profile) {
      this.patchFormDesdePerfil(this.user_profile);
    }
  }

  async guardar(): Promise<void> {
    if (!this.user?.uid) return;
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      this.showToast('Revisa los campos resaltados.', 'danger');
      return;
    }
    if (this.subiendoFoto) {
      this.showToast('Espera a que termine de subirse la foto.', 'warning');
      return;
    }

    this.guardando = true;
    const loading = await this.loadingCtrl.create({ message: 'Guardando...' });
    await loading.present();

    const valores = this.profileForm.getRawValue();
    const contactosEmergencia = (valores.contactosEmergencia as { nombre: string; telefono: string }[])
      .map(c => ({
        nombre: this.security.sanitizeText(c.nombre?.trim() ?? '', 60),
        telefono: this.security.sanitizeText(c.telefono?.trim() ?? '', 20)
      }))
      .filter((c): c is Models.Auth.ContactoEmergencia => !!(c.nombre && c.telefono));

    const payload = {
      nombre: this.security.sanitizeText(valores.nombre?.trim() ?? ''),
      apellido: this.security.sanitizeText(valores.apellido?.trim() ?? ''),
      telefono: this.security.sanitizeText(valores.telefono ?? ''),
      fechaNacimiento: this.security.sanitizeText(valores.fechaNacimiento ?? ''),
      region: this.security.sanitizeText(valores.region ?? ''),
      comuna: this.security.sanitizeText(valores.comuna ?? ''),
      direccion: this.security.sanitizeText(valores.direccion ?? ''),
      descripcion: this.security.sanitizeText(valores.descripcion ?? '', this.maxDescripcionLen),
      contactosEmergencia
    };

    try {
      await this.firestoreService.updateDocument(`${Models.Auth.PathUsers}/${this.user.uid}`, payload);
      await this.firestoreService.setPublicContact(this.user.uid, {
        nombre: payload.nombre,
        apellido: payload.apellido,
        telefono: payload.telefono,
        contactosEmergencia: payload.contactosEmergencia
      });
      this.editMode = false;
      this.showToast('Perfil actualizado correctamente.', 'success');
    } catch (err) {
      console.error('Error al actualizar perfil', err);
      this.showToast('No se pudo actualizar el perfil. Intenta nuevamente.', 'danger');
    } finally {
      this.guardando = false;
      loading.dismiss();
    }
  }

  // ── Foto de perfil ───────────────────────────────────────────────────────
  async seleccionarFoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      maxMb: 5
    });
    if (error) {
      this.showToast(error, 'danger');
      input.value = '';
      return;
    }
    if (!this.user?.uid) {
      input.value = '';
      return;
    }

    // Vista previa instantánea mientras se sube
    const reader = new FileReader();
    reader.onload = () => { this.fotoPreview = reader.result as string; };
    reader.readAsDataURL(file);

    const fotoAnterior = this.user_profile?.fotoOrigen === 'custom' ? this.user_profile?.foto : undefined;

    this.subiendoFoto = true;
    try {
      await this.firestoreService.uploadProfilePhoto(this.user.uid, file);
      this.showToast('Foto de perfil actualizada.', 'success');
      // Si había una foto propia anterior, la limpiamos del Storage (best-effort).
      if (fotoAnterior) {
        this.firestoreService.deletePhotoFromStorage(fotoAnterior).catch(() => { /* ya no existe o no se pudo borrar, no es crítico */ });
      }
    } catch (err) {
      console.error('Error subiendo foto de perfil', err);
      this.fotoPreview = null;
      this.showToast('No se pudo subir la foto. Intenta de nuevo.', 'danger');
    } finally {
      this.subiendoFoto = false;
      input.value = '';
    }
  }

  async usarFotoDeGoogle(): Promise<void> {
    if (!this.user?.uid || !this.user.photoURL) return;

    const fotoAnterior = this.user_profile?.fotoOrigen === 'custom' ? this.user_profile?.foto : undefined;

    this.subiendoFoto = true;
    try {
      await this.firestoreService.updateDocument(`${Models.Auth.PathUsers}/${this.user.uid}`, {
        foto: this.security.sanitizeUrl(this.user.photoURL),
        fotoOrigen: 'google'
      });
      this.showToast('Usando la foto de tu cuenta de Google.', 'success');
      if (fotoAnterior) {
        this.firestoreService.deletePhotoFromStorage(fotoAnterior).catch(() => { /* no crítico */ });
      }
    } catch (err) {
      console.error('Error al volver a la foto de Google', err);
      this.showToast('No se pudo cambiar la foto.', 'danger');
    } finally {
      this.subiendoFoto = false;
    }
  }

  // ── Validador custom ─────────────────────────────────────────────────────
  private validarFechaNoFutura(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const valor = control.value;
      if (!valor) return null;
      const fecha = new Date(valor);
      if (isNaN(fecha.getTime())) return null;
      return fecha.getTime() > Date.now() ? { fechaFutura: true } : null;
    };
  }

  // ── Utilidades ───────────────────────────────────────────────────────────
  private async showToast(message: string, color: 'success' | 'danger' | 'primary' | 'warning' = 'primary'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2000, color });
    t.present();
  }

  async logout(): Promise<void> {
    await this.pushNotifications.olvidarTokenActual();
    await this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }

  irAConfiguracion(): void {
    this.router.navigate(['/tabs/configuracion']);
  }

  irAMisPublicaciones(): void {
    this.router.navigate(['/tabs/mis-publicaciones']);
  }

  irANotificaciones(): void {
    this.router.navigate(['/tabs/notificaciones']);
  }

  async cancelarTransferenciaEnviada(t: Models.Transferencias.Transferencia): Promise<void> {
    if (!t.id) return;
    try {
      await this.firestoreService.cancelarTransferencia(t.id);
      await this.showToast('Transferencia cancelada.', 'primary');
    } catch {
      await this.showToast('No se pudo cancelar la transferencia.', 'danger');
    }
  }

  // ── Equipo de refugio ────────────────────────────────────────────────────

  async invitarAlEquipo(): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Invitar al equipo',
      message: 'La persona va a poder crear/editar mascotas y publicaciones en nombre de tu cuenta de refugio.',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email de la persona' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Como staff', handler: (data) => this.enviarInvitacionEquipo(data.email, 'staff') },
        { text: 'Como admin', handler: (data) => this.enviarInvitacionEquipo(data.email, 'admin') },
      ]
    });
    await alert.present();
  }

  private async enviarInvitacionEquipo(rawEmail: string, rolEquipo: Models.Equipo.RolEquipo): Promise<void> {
    const email = this.security.sanitizeText(rawEmail || '', 200);
    if (!this.security.isValidEmail(email)) {
      await this.showToast('Ingresa un email válido.', 'danger');
      return;
    }
    if (!this.user) return;
    try {
      const refugioNombre = this.user_profile?.nombreRefugio?.trim()
        || `${this.user_profile?.nombre ?? ''} ${this.user_profile?.apellido ?? ''}`.trim()
        || 'Un refugio';
      await this.firestoreService.crearInvitacionEquipo(this.user.uid, refugioNombre, email, rolEquipo);
      await this.showToast('Invitación enviada.', 'success');
    } catch {
      await this.showToast('No se pudo enviar la invitación.', 'danger');
    }
  }

  async cancelarInvitacionEquipo(inv: Models.Equipo.InvitacionEquipo): Promise<void> {
    if (!inv.id) return;
    try {
      await this.firestoreService.cancelarInvitacionEquipo(inv.id);
      await this.showToast('Invitación cancelada.', 'primary');
    } catch {
      await this.showToast('No se pudo cancelar la invitación.', 'danger');
    }
  }

  async quitarMiembro(m: Models.Equipo.MiembroEquipo): Promise<void> {
    if (!this.user) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar del equipo',
      message: `¿Sacar a ${m.nombre} del equipo? Ya no va a poder operar tu cuenta.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestoreService.quitarMiembroEquipo(this.user!.uid, m.uid);
              await this.showToast('Se quitó del equipo.', 'primary');
            } catch {
              await this.showToast('No se pudo quitar del equipo.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async salirDelEquipo(refugioUid: string): Promise<void> {
    if (!this.user) return;
    try {
      await this.firestoreService.quitarMiembroEquipo(refugioUid, this.user.uid);
      await this.showToast('Saliste del equipo.', 'primary');
    } catch {
      await this.showToast('No se pudo salir del equipo.', 'danger');
    }
  }

}