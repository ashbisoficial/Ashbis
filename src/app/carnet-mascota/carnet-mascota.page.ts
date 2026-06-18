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

    // 2. Datos del dueño (solo nombre/teléfono para carnet)
    if (this.mascota?.uidUsuario) {
      const duenoSnap = await getDoc(
        doc(this.firestore, `usuarios/${this.mascota.uidUsuario}`)
      );
      if (duenoSnap.exists()) {
        const d = duenoSnap.data();
        // Exponemos solo lo necesario para el carnet
        this.dueno = {
          nombre: d['nombre'] ?? '',
          apellido: d['apellido'] ?? '',
          telefono: d['telefono'] ?? ''
        };
      }
    }

    // 3. Subcolecciones médicas
    const basePath = `mascotas/${id}`;

    const [vacSnap, medSnap, exSnap, citaSnap] = await Promise.all([
      getDocs(query(collection(this.firestore, `${basePath}/vacunas`), orderBy('fechaAplicacion', 'desc'))),
      getDocs(query(collection(this.firestore, `${basePath}/medicamentos`), orderBy('fechaInicio', 'desc'))),
      getDocs(query(collection(this.firestore, `${basePath}/examenes`), orderBy('fechaProgramada', 'asc'))),
      getDocs(query(collection(this.firestore, `${basePath}/citas`), orderBy('fechaInicio', 'asc')))
    ]);

    this.vacunas     = vacSnap.docs.map(d => d.data());
    this.medicamentos = medSnap.docs.map(d => d.data());
    this.examenes    = exSnap.docs.map(d => d.data());
    this.citas       = citaSnap.docs.map(d => d.data());
  }
}