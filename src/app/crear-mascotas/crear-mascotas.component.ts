import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import {
  AlertController,
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCheckbox,
  IonCol,
  IonContent,
  IonDatetime,
  IonGrid,
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
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, cameraOutline, cloudUploadOutline, closeCircle, imageOutline, imagesOutline, trashOutline } from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';

@Component({
  selector: 'app-crear-mascota',
  standalone: true,
  templateUrl: './crear-mascotas.component.html',
  styleUrls: ['./crear-mascotas.component.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonAccordion,
    IonAccordionGroup,
    IonItem,
    IonLabel,
    IonCheckbox,
    IonContent,
    IonGrid,
    IonRow,
    IonCol,
    IonList,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonNote,
    IonButton,
    IonImg,
    IonModal,
    IonDatetime,
    IonIcon,
    IonSpinner
  ]
})
export class CrearMascotasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly authService = inject(AuthenticationService);
  private readonly storage = inject(Storage);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly security = inject(SecurityService);

  mascotaForm!: FormGroup;
  cargando = false;
  imagenPreview: string | ArrayBuffer | null = null;
  imagenFile: File | null = null;
  galeriaFiles: File[] = [];
  galeriaPreviews: string[] = [];
  fechaFormateada = '';
  fechaActual = new Date().toISOString();
  mostrarCalendario = false;
  fechaTemp: string | null = null;

  private readonly allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  private readonly maxFileBytes = 5 * 1024 * 1024;

  comportamientoOptions = [
    { label: 'Tener cuidado con otros animales', value: 'cuidado_otros_animales' },
    { label: 'Tener cuidado con mujeres', value: 'cuidado_mujeres' },
    { label: 'Tener cuidado con hombres', value: 'cuidado_hombres' },
    { label: 'Tener cuidado con ninos', value: 'cuidado_ninos' },
    { label: 'Tener cuidado con su misma especie', value: 'cuidado_misma_especie' },
    { label: 'Necesita compania constante', value: 'necesita_compania' },
    { label: 'Es temeroso', value: 'temeroso' },
    { label: 'Es agresivo', value: 'agresivo' },
    { label: 'Ninguno', value: 'ninguno' }
  ];
  comportamientoSelected: string[] = [];

  constructor() {
    addIcons({ cameraOutline, imageOutline, imagesOutline, trashOutline, addOutline, cloudUploadOutline, closeCircle });
  }

  ngOnInit(): void {
    this.mascotaForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(40)]],
      numeroChip: ['', [Validators.pattern(/^\d{15}$/)]],
      edad: ['', [Validators.required, Validators.min(0), Validators.max(40)]],
      sexo: ['', Validators.required],
      fechaNacimiento: ['', Validators.required],
      especie: ['', Validators.required],
      tamano: ['', Validators.required],
      peso: ['', [Validators.required, Validators.min(0.1), Validators.max(200)]],
      color: ['', [Validators.required, Validators.minLength(3)]],
      raza: ['', [Validators.required, Validators.minLength(2)]],
      castrado: ['', Validators.required],
      procedencia: ['', Validators.required],
      senas: ['', [Validators.required, Validators.minLength(3)]],
      notas: [''],
      fotoUrl: ['']
    });
  }

  isInvalid(ctrl: string): boolean {
    const c = this.mascotaForm.get(ctrl);
    return !!(c && c.touched && c.invalid);
  }

  async onImageSelected(event: any): Promise<void> {
    const file: File | undefined = event.target.files?.[0];
    if (!file) return;
    if (!this.allowedMime.includes(file.type)) {
      await this.presentAlert('Solo se permiten imagenes JPEG, PNG, WebP o GIF.');
      event.target.value = '';
      return;
    }
    if (file.size > this.maxFileBytes) {
      await this.presentAlert('La imagen no puede superar los 5 MB.');
      event.target.value = '';
      return;
    }
    this.imagenFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.imagenPreview = reader.result);
    reader.readAsDataURL(file);
    event.target.value = '';
  }

  async onImagesSelected(event: any): Promise<void> {
    const files: FileList = event.target.files;
    if (!files || !files.length) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!this.allowedMime.includes(file.type)) {
        await this.presentAlert('Solo se permiten imagenes JPEG, PNG, WebP o GIF.');
        continue;
      }
      if (file.size > this.maxFileBytes) {
        await this.presentAlert('Cada imagen de galeria debe ser menor a 5 MB.');
        continue;
      }
      this.galeriaFiles.push(file);
      const reader = new FileReader();
      reader.onload = () => this.galeriaPreviews.push(reader.result as string);
      reader.readAsDataURL(file);
    }
    event.target.value = '';
  }

  removeFromGaleria(i: number): void {
    this.galeriaFiles.splice(i, 1);
    this.galeriaPreviews.splice(i, 1);
  }

  toggleComportamiento(value: string, ev: any): void {
    const checked = ev?.detail?.checked;
    if (checked) {
      if (!this.comportamientoSelected.includes(value)) this.comportamientoSelected.push(value);
      return;
    }
    this.comportamientoSelected = this.comportamientoSelected.filter((v) => v !== value);
  }

  onIonDateChange(ev: CustomEvent): void {
    const valor = (ev as any).detail?.value as string | null;
    if (!valor) return;
    this.mascotaForm.patchValue({ fechaNacimiento: valor });
    const fecha = new Date(valor);
    this.fechaFormateada = fecha.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  async guardarMascota(): Promise<void> {
    this.mascotaForm.markAllAsTouched();
    if (this.mascotaForm.invalid) {
      await this.presentAlert('Completa todos los campos obligatorios.');
      return;
    }

    this.cargando = true;
    const data = this.mascotaForm.value;

    try {
      const user = await this.authService.getUser();
      if (!user) throw new Error('Usuario no autenticado');
      const id = this.firestoreService.createId();

      let fotoUrl = '';
      let galeriaUrls: string[] = [];

      if (this.imagenFile) {
        const refPrincipal = ref(this.storage, `mascotas/${user.uid}/${id}/foto/${Date.now()}-${this.imagenFile.name}`);
        await uploadBytes(refPrincipal, this.imagenFile);
        fotoUrl = await getDownloadURL(refPrincipal);
      }

      if (this.galeriaFiles.length) {
        galeriaUrls = await Promise.all(
          this.galeriaFiles.map(async (file, idx) => {
            const refGaleria = ref(this.storage, `mascotas/${user.uid}/${id}/galeria/${Date.now()}-${idx}-${file.name}`);
            await uploadBytes(refGaleria, file);
            return getDownloadURL(refGaleria);
          })
        );
      }

      const mascota = this.security.sanitizeFirestoreObject({
        id,
        uidUsuario: user.uid,
        creadoPor: user.uid,
        nombre: data.nombre ?? '',
        numeroChip: data.numeroChip ?? '',
        edad: data.edad ?? null,
        sexo: data.sexo ?? '',
        especie: data.especie ?? '',
        tamano: data.tamano ?? '',
        peso: data.peso ?? null,
        color: data.color ?? '',
        raza: data.raza ?? '',
        castrado: data.castrado ?? '',
        procedencia: data.procedencia ?? '',
        senas: data.senas ?? '',
        notas: data.notas ?? '',
        indicadores: this.comportamientoSelected ?? [],
        fotoUrl: fotoUrl ?? '',
        galeria: galeriaUrls ?? [],
        fechaNacimiento: data.fechaNacimiento ?? null,
        fechaRegistro: new Date().toISOString()
      });

      await this.firestoreService.createDocument(Models.Mascotas.PathMascotas, mascota, id);

      this.mascotaForm.reset();
      this.imagenFile = null;
      this.imagenPreview = null;
      this.galeriaFiles = [];
      this.galeriaPreviews = [];
      this.comportamientoSelected = [];
      this.router.navigate(['/tabs/listar-mascotas']);
    } catch (err) {
      console.error('Error al guardar mascota:', err);
      await this.presentAlert('Ocurrio un error al guardar.');
    } finally {
      this.cargando = false;
    }
  }

  async presentAlert(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Atencion',
      message,
      buttons: ['Aceptar']
    });
    await alert.present();
  }

  abrirCalendario(): void {
    this.fechaTemp = this.mascotaForm.get('fechaNacimiento')?.value || null;
    this.mostrarCalendario = true;
  }

  onFechaTempChange(event: any): void {
    this.fechaTemp = event.detail.value;
  }

  cancelarFecha(): void {
    this.mostrarCalendario = false;
  }

  confirmarFecha(): void {
    if (!this.fechaTemp) return;
    this.mascotaForm.patchValue({ fechaNacimiento: this.fechaTemp });
    this.fechaFormateada = new Date(this.fechaTemp).toLocaleDateString('es-CL');
    this.mostrarCalendario = false;
  }
}