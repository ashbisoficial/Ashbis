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
  IonModal,
  IonNote,
  IonRow,
  IonSkeletonText,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar
} from '@ionic/angular/standalone';
import { LoadingController, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  cameraOutline, createOutline, logoGoogle, closeOutline, trashOutline,
  checkmarkOutline, personCircleOutline, alertCircleOutline,
  personOutline, mailOutline, callOutline, calendarOutline, locationOutline,
  documentTextOutline, refreshOutline, addOutline, medkitOutline, settingsOutline,
  qrCodeOutline, shieldCheckmarkOutline, logoDiscord, cardOutline,
} from 'ionicons/icons';
import { QRCodeComponent } from 'angularx-qrcode';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';
import { PreferenciasService } from '../services/preferencias.service';
import { RegionComunaSelectComponent } from '../shared/components/region-comuna-select/region-comuna-select.component';

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
    IonButton,
    IonGrid,
    IonRow,
    IonCol,
    IonIcon,
    IonSpinner,
    IonBadge,
    IonNote,
    IonModal,
    QRCodeComponent,
    RegionComunaSelectComponent
  ],
  providers: [DatePipe]
})
export class PerfilComponent implements OnDestroy {
  private readonly destroy$ = new Subject<void>();
  private readonly auth = inject(AuthenticationService);
  private readonly router = inject(Router);
  private readonly security = inject(SecurityService);
  private readonly preferencias = inject(PreferenciasService);

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

  // ── Mi QR (adopción/hogar temporal sin tipear el email) ──────────────────
  mostrarModalQr = false;
  cargandoQr = false;
  miQrToken: string | null = null;

  transferenciasPendientes: Models.Transferencias.Transferencia[] = [];

  invitacionesEquipoPendientes: Models.Equipo.InvitacionEquipo[] = [];
  /** Refugios ajenos de cuyo equipo formo parte. Solo se muestra el nombre
   *  acá — gestionar el equipo vive en el panel del refugio, y salir de un
   *  equipo vive en Configuración (ver ConfiguracionComponent). */
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
  /** Acepta RUT chileno con o sin puntos, con guión y dígito verificador
   *  (0-9 o k/K) — ej. "12.345.678-9" o "12345678-9". */
  private readonly rutRegex = /^\d{1,2}\.?\d{3}\.?\d{3}-[\dkK]$/;

  profileForm = this.fb.group({
    nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60), Validators.pattern(this.nombreRegex)]],
    apellido: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60), Validators.pattern(this.nombreRegex)]],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    telefono: ['', [Validators.pattern(this.telefonoRegex)]],
    rut: ['', [Validators.pattern(this.rutRegex)]],
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
      checkmarkOutline, personCircleOutline, alertCircleOutline,
      personOutline, mailOutline, callOutline, calendarOutline, locationOutline,
      documentTextOutline, refreshOutline, trashOutline, addOutline, medkitOutline,
      settingsOutline, qrCodeOutline, shieldCheckmarkOutline, logoDiscord, cardOutline,
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
          this.cargarTransferencias(res.email);
          this.cargarEquipo(res.uid, res.email);
        } else {
          this.user = null;
          this.user_profile = undefined;
          this.transferenciasPendientes = [];
          this.invitacionesEquipoPendientes = [];
          this.refugiosEnLosQueColaboro = [];
          this.cargando = false;
        }
      });
  }

  private cargarTransferencias(email: string | null): void {
    if (!email) return;
    this.firestoreService.getTransferenciasPendientesParaMi(email)
      .pipe(takeUntil(this.destroy$))
      .subscribe(t => this.transferenciasPendientes = t);
  }

  private cargarEquipo(uid: string, email: string | null): void {
    if (email) {
      this.firestoreService.getInvitacionesEquipoPendientesParaMi(email)
        .pipe(takeUntil(this.destroy$))
        .subscribe(inv => this.invitacionesEquipoPendientes = inv);
    }
    // Equipos de refugios ajenos de los que formo parte: solo para mostrar
    // el nombre acá (gestionarlos vive en el panel del refugio y en
    // Configuración, ver comentario arriba de refugiosEnLosQueColaboro).
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
      rut: perfil.rut ?? '',
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

  /** Abre el selector de archivos nativo (oculto) para elegir una foto
   *  nueva, solo si la cámara/galería está habilitada en Configuración →
   *  Permisos (preferencia propia de Ashbis, no el permiso real del
   *  navegador). */
  abrirSelectorFoto(): void {
    if (this.subiendoFoto) return;
    if (!this.preferencias.camaraHabilitada) {
      this.showToast('Activa la cámara en Configuración → Permisos para subir fotos.', 'danger');
      return;
    }
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
      if (campo === 'rut') return 'Formato de RUT inválido. Ej: 12.345.678-9';
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
      rut: this.security.sanitizeText(valores.rut ?? ''),
      fechaNacimiento: this.security.sanitizeText(valores.fechaNacimiento ?? ''),
      region: this.security.sanitizeText(valores.region ?? ''),
      comuna: this.security.sanitizeText(valores.comuna ?? ''),
      direccion: this.security.sanitizeText(valores.direccion ?? ''),
      descripcion: this.security.sanitizeText(valores.descripcion ?? '', this.maxDescripcionLen),
      contactosEmergencia
    };

    try {
      // Si la conexión con Firestore quedó colgada (por ejemplo, justo
      // después de volver del segundo plano con mala señal), updateDoc
      // puede no resolver NUNCA — sin este timeout, el botón de guardar se
      // quedaba girando para siempre y no había forma de salir salvo
      // cerrar la app. Con el timeout, al menos se recupera con un error
      // claro para que la persona pueda reintentar.
      await this.conTimeout(
        Promise.all([
          this.firestoreService.updateDocument(`${Models.Auth.PathUsers}/${this.user.uid}`, payload),
          this.firestoreService.setPublicContact(this.user.uid, {
            nombre: payload.nombre,
            apellido: payload.apellido,
            telefono: payload.telefono,
            contactosEmergencia: payload.contactosEmergencia
          }),
        ]),
        20_000
      );
      this.editMode = false;
      this.showToast('Perfil actualizado correctamente.', 'success');
    } catch (err) {
      console.error('Error al actualizar perfil', err);
      const mensaje = err instanceof Error && err.message === 'TIMEOUT'
        ? 'La conexión está tardando demasiado. Revisa tu conexión e intenta nuevamente.'
        : 'No se pudo actualizar el perfil. Intenta nuevamente.';
      this.showToast(mensaje, 'danger');
    } finally {
      this.guardando = false;
      loading.dismiss();
    }
  }

  /** Si la promesa no resuelve dentro de ms, rechaza con Error('TIMEOUT') en
   *  vez de dejar a quien llama esperando para siempre. No cancela la
   *  operación original (Firestore no lo permite), solo deja de esperarla. */
  private conTimeout<T>(promesa: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const id = setTimeout(() => reject(new Error('TIMEOUT')), ms);
      promesa.then(
        (v) => { clearTimeout(id); resolve(v); },
        (e) => { clearTimeout(id); reject(e); }
      );
    });
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

  irAConfiguracion(): void {
    this.router.navigate(['/tabs/configuracion']);
  }

  /** Mismo criterio que adminGuard/esAdminAshbis/ADMIN_EMAILS — muestra el
   *  acceso al panel de verificación solo a la cuenta de Ashbis. */
  get esAdmin(): boolean {
    return this.user?.email === 'ashbis.oficial@gmail.com';
  }

  irAAdminVeterinarios(): void {
    this.router.navigate(['/tabs/admin-veterinarios']);
  }

  async abrirMiQr(): Promise<void> {
    if (!this.user) return;
    this.cargandoQr = true;
    this.mostrarModalQr = true;
    try {
      this.miQrToken = await this.firestoreService.obtenerOCrearQrCuenta(this.user.uid);
    } catch {
      this.mostrarModalQr = false;
      await this.showToast('No se pudo generar tu QR. Intenta nuevamente.', 'danger');
    } finally {
      this.cargandoQr = false;
    }
  }

  cerrarModalQr(): void {
    this.mostrarModalQr = false;
  }

  irANotificaciones(): void {
    this.router.navigate(['/tabs/notificaciones']);
  }


}