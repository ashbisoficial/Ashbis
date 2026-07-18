import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PublicQrService } from 'src/app/services/public-qr.service';
import { getDownloadURL, ref, Storage, uploadBytes } from '@angular/fire/storage';
import {
  AlertController,
  IonAccordion,
  IonAccordionGroup,
  IonButton,
  IonCheckbox,
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
  IonSpinner
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { addOutline, cameraOutline, cloudUploadOutline, closeCircle, imageOutline, imagesOutline, trashOutline } from 'ionicons/icons';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { FirestoreService } from 'src/app/firebase/firestore';
import { Firestore, doc, getDoc, getDocs, collection, query, where, increment, updateDoc } from '@angular/fire/firestore';
import { Models } from 'src/app/models/models';
import { SecurityService } from 'src/app/services/security.service';
import { getFriendlyErrorMessage } from 'src/app/services/firebase-error.util';

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
    IonIcon,
    IonSpinner
  ]
})
export class CrearMascotasComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly firestoreService = inject(FirestoreService);
  private readonly firestore = inject(Firestore);
  private readonly authService = inject(AuthenticationService);
  private readonly storage = inject(Storage);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);
  private readonly security = inject(SecurityService);
  private readonly publicQrService = inject(PublicQrService);
  mascotaForm!: FormGroup;
  cargando = false;
  imagenPreview: string | ArrayBuffer | null = null;
  imagenFile: File | null = null;
  galeriaFiles: File[] = [];
  galeriaPreviews: string[] = [];
  readonly hoy = new Date().toISOString().split('T')[0];

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

    if (!user) {
      this.cargando = false;
      await this.presentAlert('Tu sesión expiró. Por favor inicia sesión nuevamente.');
      return;
    }

    // Verificar límite de mascotas. Un refugio/rescatista maneja varias
    // mascotas a la vez, así que arranca con un tope mucho más alto que
    // una cuenta normal (que sigue en el plan free de 2).
    const userSnap = await getDoc(doc(this.firestore, `usuarios/${user.uid}`));
    const userData = userSnap.data() as any;
    const maxPetsPorDefecto = userData?.rol === 'refugio' ? 50 : 2;
    const maxPets = userData?.maxPets ?? maxPetsPorDefecto;

    const mascotasSnap = await getDocs(
      query(collection(this.firestore, 'mascotas'), where('uidUsuario', '==', user.uid))
    );

    if (mascotasSnap.size >= maxPets) {
      await this.alertCtrl.create({
        header: 'Límite alcanzado',
        message: `Tu plan actual permite hasta ${maxPets} mascotas. Actualiza a Premium para agregar más.`,
        buttons: ['Entendido']
      }).then(a => a.present());
      this.cargando = false;
      return;
    }

    const id = this.firestoreService.createId();

    console.log('ID MASCOTA:', id);

    const qrCarnetToken = this.publicQrService.generateToken();
    const qrPerdidaToken = this.publicQrService.generateToken();

    let fotoUrl = '';
    let galeriaUrls: string[] = [];

    // FOTO PRINCIPAL
    if (this.imagenFile) {
      const pathFoto =
        `mascotas/${user.uid}/${id}/foto/${Date.now()}-${this.imagenFile.name}`;

      console.log('PATH FOTO:', pathFoto);
      console.log('ARCHIVO FOTO:', this.imagenFile);

      const refPrincipal = ref(this.storage, pathFoto);

      await uploadBytes(refPrincipal, this.imagenFile);

      console.log('UPLOAD FOTO OK');

      fotoUrl = await getDownloadURL(refPrincipal);

      console.log('URL FOTO:', fotoUrl);
    }

    // GALERÍA
    if (this.galeriaFiles.length) {
      galeriaUrls = await Promise.all(
        this.galeriaFiles.map(async (file, idx) => {

          const pathGaleria =
            `mascotas/${user.uid}/${id}/galeria/${Date.now()}-${idx}-${file.name}`;

          console.log('PATH GALERIA:', pathGaleria);

          const refGaleria = ref(this.storage, pathGaleria);

          await uploadBytes(refGaleria, file);

          console.log('UPLOAD GALERIA OK');

          const url = await getDownloadURL(refGaleria);

          console.log('URL GALERIA:', url);

          return url;
        })
      );
    }

    const mascota = this.security.sanitizeFirestoreObject({
      id,
      qrCarnetToken,
      qrPerdidaToken,
      estado: 'normal',
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

    console.log('MASCOTA A GUARDAR:', mascota);

    await this.firestoreService.createDocument(
      Models.Mascotas.PathMascotas,
      mascota,
      id
    );

    // Incrementar contador de mascotas del usuario
    await updateDoc(doc(this.firestore, `usuarios/${user.uid}`), {
      petCount: increment(1)
    });

    console.log('DOCUMENTO MASCOTA CREADO');

    await this.publicQrService.createQrToken(
      id,
      user.uid,
      'carnet',
      qrCarnetToken
    );

    console.log('QR CARNET CREADO');

    await this.publicQrService.createQrToken(
      id,
      user.uid,
      'perdida',
      qrPerdidaToken
    );

    console.log('QR PERDIDA CREADO');

    this.mascotaForm.reset();
    this.imagenFile = null;
    this.imagenPreview = null;
    this.galeriaFiles = [];
    this.galeriaPreviews = [];
    this.comportamientoSelected = [];

    this.router.navigate(['/tabs/listar-mascotas']);

  } catch (err: any) {

    console.error('ERROR COMPLETO:', err);
    console.error('CODE:', err?.code);
    console.error('MESSAGE:', err?.message);

    await this.presentAlert(getFriendlyErrorMessage(err, 'firestore'));

  } finally {
    this.cargando = false;
  }
}

  async presentAlert(message: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Atención',
      message,
      buttons: ['Aceptar']
    });
    await alert.present();
  }

}