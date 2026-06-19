import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonContent,
  IonSpinner,
  IonBadge
} from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
import { PublicQrService } from '../services/public-qr.service';
import {
  Firestore,
  doc,
  getDoc,
  collection,
  getDocs,
  query,
  orderBy
} from '@angular/fire/firestore';

@Component({
  selector: 'app-carnet-mascota',
  templateUrl: './carnet-mascota.page.html',
  styleUrls: ['./carnet-mascota.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    IonContent,
    IonSpinner,
    IonBadge,
    QRCodeComponent
  ],
  providers: [DatePipe]
})
export class CarnetMascotaPage implements OnInit {

  private route = inject(ActivatedRoute);
  private firestore = inject(Firestore);
  private publicQrService = inject(PublicQrService);
  mascota: any = null;
  dueno: any = null;
  vacunas: any[] = [];
  medicamentos: any[] = [];
  examenes: any[] = [];
  citas: any[] = [];

  cargando = true;
  error = false;
  qrUrl = '';

  async ngOnInit() {

  const tokenOrId =
    this.route.snapshot.paramMap.get('id');

  console.log('TOKEN RECIBIDO:', tokenOrId);

  if (!tokenOrId) {
    this.error = true;
    this.cargando = false;
    return;
  }

  try {

    const qrData =
      await this.publicQrService.getQrToken(
        'carnet',
        tokenOrId
      );

    console.log('QR DATA:', qrData);

    if (qrData?.mascotaId) {

      await this.cargarMascota(
        qrData.mascotaId
      );

    } else {

      // compatibilidad mascotas antiguas
      await this.cargarMascota(
        tokenOrId
      );

    }

  } catch (e) {

    console.error(
      'Error cargando carnet:',
      e
    );

    this.error = true;

  } finally {

    this.cargando = false;

  }
}

  private async cargarMascota(id: string): Promise<void> {

  console.log('CARGANDO MASCOTA ID:', id);

  const mascotaSnap = await getDoc(
    doc(this.firestore, `mascotas/${id}`)
  );

  console.log('EXISTE MASCOTA:', mascotaSnap.exists());

  if (mascotaSnap.exists()) {
    console.log('DATOS MASCOTA:', mascotaSnap.data());
  }

  if (!mascotaSnap.exists()) {
    this.error = true;
    return;
  }

  this.mascota = mascotaSnap.data();
    this.qrUrl = `${window.location.origin}/carnet/${id}`;

    // 2. Datos de contacto del dueño: leemos la copia pública y mínima
    // (usuarios/{uid}/publico/contacto), nunca el perfil privado completo.
    if (this.mascota?.uidUsuario) {
      try {
        const contactoSnap = await getDoc(
          doc(this.firestore, `usuarios/${this.mascota.uidUsuario}/publico/contacto`)
        );
        if (contactoSnap.exists()) {
          const d = contactoSnap.data();
          this.dueno = {
            nombre: d['nombre'] ?? '',
            apellido: d['apellido'] ?? '',
            telefono: d['telefono'] ?? ''
          };
        }
      } catch (e) {
        console.warn('No se pudo cargar el contacto del dueño:', e);
      }
    }

    const basePath = `mascotas/${id}`;

    const cargarSubcoleccion = async (
      nombre: string,
      ruta: string,
      campoOrden: string,
      direccion: 'asc' | 'desc'
    ): Promise<any[]> => {
      try {
        const snap = await getDocs(query(collection(this.firestore, ruta), orderBy(campoOrden, direccion)));
        return snap.docs.map(d => d.data());
      } catch (e) {
        console.warn(`No se pudo cargar "${nombre}" en el carnet público:`, e);
        return [];
      }
    };

    [this.vacunas, this.medicamentos, this.examenes, this.citas] = await Promise.all([
      cargarSubcoleccion('vacunas', `${basePath}/vacunas`, 'fechaAplicacion', 'desc'),
      cargarSubcoleccion('medicamentos', `${basePath}/medicamentos`, 'fechaInicio', 'desc'),
      cargarSubcoleccion('examenes', `${basePath}/examenes`, 'fechaProgramada', 'asc'),
      cargarSubcoleccion('citas', `${basePath}/citas`, 'fechaInicio', 'asc')
    ]);
  }
  traducirIndicador(valor: string): string {

  const mapa: Record<string,string> = {

    cuidado_otros_animales: '⚠️ Otros animales',
    cuidado_mujeres: '⚠️ Mujeres',
    cuidado_hombres: '⚠️ Hombres',
    cuidado_ninos: '⚠️ Niños',

    cuidado_misma_especie: '⚠️ Misma especie',

    necesita_compania: '❤️ Necesita compañía',

    temeroso: '😟 Temeroso',

    agresivo: '🚫 Agresivo'
  };

  return mapa[valor] || valor;
}
}