import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import {
  IonContent,
  IonSpinner,
  IonBadge
} from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
import { environment } from 'src/environments/environment';

// URL base de Cloud Functions — debe coincidir con el PROJECT_ID en .firebaserc
const CF_BASE = 'https://us-central1-ashbis-ae5b2.cloudfunctions.net';

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
    const token = this.route.snapshot.paramMap.get('id');

    if (!token) {
      this.error = true;
      this.cargando = false;
      return;
    }

    try {
      const url = `${CF_BASE}/getCarnetPublico?token=${encodeURIComponent(token)}&tipo=carnet`;
      const res = await fetch(url);

      if (!res.ok) {
        this.error = true;
        return;
      }

      const data = await res.json();
      this.mascota     = data.mascota ?? null;
      this.dueno       = data.dueno ?? null;
      this.vacunas     = data.vacunas ?? [];
      this.medicamentos = data.medicamentos ?? [];
      this.examenes    = data.examenes ?? [];
      this.citas       = data.citas ?? [];

      if (!this.mascota) { this.error = true; return; }

      this.qrUrl = `${environment.appUrl}/carnet/${token}`;

    } catch (e) {
      console.error('Error cargando carnet:', e);
      this.error = true;
    } finally {
      this.cargando = false;
    }
  }

  traducirIndicador(valor: string): string {
    const mapa: Record<string, string> = {
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