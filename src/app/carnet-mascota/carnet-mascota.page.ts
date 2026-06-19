import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonContent,
  IonSpinner,
  IonBadge
} from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';

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
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error = true;
      this.cargando = false;
      return;
    }

    try {
      await this.cargarMascota(id);
    } catch (e) {
      console.error('Error cargando carnet:', e);
      this.error = true;
    } finally {
      this.cargando = false;
    }
  }

  private async cargarMascota(id: string): Promise<void> {
    // 1. Datos de la mascota (Firestore reglas permiten leer carnet/{id} público)
    const mascotaSnap = await getDoc(doc(this.firestore, `mascotas/${id}`));
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
}