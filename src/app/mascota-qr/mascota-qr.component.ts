import { Component, inject, OnDestroy, OnInit, ViewChild, ElementRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { QRCodeComponent } from 'angularx-qrcode';

import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { downloadOutline, shareOutline } from 'ionicons/icons';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Models } from '../models/models';

@Component({
  selector: 'app-mascota-qr',
  templateUrl: './mascota-qr.component.html',
  styleUrls: ['./mascota-qr.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
    IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
    IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
    IonSelect, IonSelectOption, IonSegment, IonSegmentButton,
    QRCodeComponent
  ]
})
export class MascotaQrComponent implements OnInit, OnDestroy {

  @ViewChild('qrMedicoEl')    qrMedicoEl!: ElementRef;
  @ViewChild('qrEmergenciaEl') qrEmergenciaEl!: ElementRef;

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  authenticationService = inject(AuthenticationService);
  firestoreService = inject(FirestoreService);

  // ── Estado ──────────────────────────────────────────────────────────────
  cargando = signal(true);
  descargandoPDF = false;

  // ── Datos ───────────────────────────────────────────────────────────────
  userProfile: Models.Auth.UserProfile | null = null;
  misMascotas = signal<Mascota[]>([]);
  mascotaSeleccionada = signal<Mascota | null>(null);

  private targetMascotaId: string | null = null;

  // ── Tipo de QR activo ───────────────────────────────────────────────────
  tipoQR: 'medico' | 'emergencia' = 'medico';
  qrFichaMedica  = '';
  qrEmergencia   = '';

  get qrActivo() {
    return this.tipoQR === 'medico' ? this.qrFichaMedica : this.qrEmergencia;
  }

  get tituloQR() {
    return this.tipoQR === 'medico' ? '🏥 Ficha Médica' : '🚨 QR de Emergencia';
  }

  get descripcionQR() {
    return this.tipoQR === 'medico'
      ? 'Escanea para ver el historial veterinario completo'
      : 'Si pierdo a mi mascota, escanea para contactar al dueño';
  }

  constructor() {
    addIcons({ downloadOutline, shareOutline });
  }

  ngOnInit() {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['mascotaId']) {
          this.targetMascotaId = params['mascotaId'];
          this.intentarSeleccionarMascota();
        }
      });

    this.cargarDatos();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cargarDatos() {
    this.cargando.set(true);

    this.authenticationService.authState$
      .pipe(takeUntil(this.destroy$))
      .subscribe(user => {
        if (!user) { this.cargando.set(false); return; }

        const perfil$ = this.firestoreService.getDocumentChanges<Models.Auth.UserProfile>(
          `${Models.Auth.PathUsers}/${user.uid}`
        );
        const mascotas$ = this.firestoreService.getUserPets(user.uid);

        combineLatest([perfil$, mascotas$])
          .pipe(takeUntil(this.destroy$))
          .subscribe(([perfil, mascotas]) => {
            this.userProfile = perfil || null;
            this.misMascotas.set(mascotas || []);
            this.intentarSeleccionarMascota();
            this.cargando.set(false);
          });
      });
  }

  intentarSeleccionarMascota() {
    const mascotas = this.misMascotas();
    if (!mascotas.length) return;

    if (this.targetMascotaId) {
      const encontrada = mascotas.find(m => m.id === this.targetMascotaId);
      if (encontrada && this.mascotaSeleccionada()?.id !== encontrada.id) {
        this.seleccionarMascota(encontrada);
        return;
      }
    }

    if (!this.mascotaSeleccionada()) {
      this.seleccionarMascota(mascotas[0]);
    }
  }

  seleccionarMascota(m: Mascota) {
    this.mascotaSeleccionada.set(m);
    this.generarQRs(m);
  }

  onMascotaChange(event: any) {
    const id = event.detail.value;
    const m = this.misMascotas().find(p => p.id === id);
    if (m) { this.targetMascotaId = id; this.seleccionarMascota(m); }
  }

  // ── Generar QRs ────────────────────────────────────────────────────────
  generarQRs(mascota: Mascota) {
    if (!this.userProfile) return;

    const user = this.userProfile;
    const m: any = mascota;
    const telefono = user.telefono || '';
    const nombreDueno = `${user.nombre || ''} ${user.apellido || ''}`.trim();

    // QR Médico: URL al carnet público
    const baseUrl = window.location.origin;
    this.qrFichaMedica = `${baseUrl}/carnet/${mascota.id}`;

    // QR Emergencia: texto plano con info de contacto y cuidados
    const indicadores = (m.indicadores || []).join(', ') || 'Sin indicadores especiales';
    const cuidados = m.medicamentos?.length
      ? `Está en tratamiento con medicamentos.`
      : '';

    this.qrEmergencia = [
      `MASCOTA PERDIDA`,
      ``,
      `Nombre: ${m.nombre}`,
      `Especie: ${m.especie} - ${m.raza}`,
      `Chip: ${m.numeroChip || 'No registrado'}`,
      ``,
      `CONTACTAR A:`,
      `Dueño/a: ${nombreDueno}`,
      `Teléfono: ${telefono || 'No disponible'}`,
      ``,
      `CUIDADOS ESPECIALES:`,
      indicadores,
      cuidados
    ].filter(Boolean).join('\n').trim();
  }

  // ── Descargar PDF ───────────────────────────────────────────────────────
  async descargarPDF() {
    this.descargandoPDF = true;
    try {
      const elementId = this.tipoQR === 'medico' ? 'qrMedicoCard' : 'qrEmergenciaCard';
      const element = document.getElementById(elementId);
      if (!element) throw new Error('Elemento QR no encontrado');

      const canvas = await html2canvas(element, { scale: 3, useCORS: true });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const width = pdf.internal.pageSize.getWidth();
      const imgWidth = 120;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      const nombre = this.mascotaSeleccionada()?.nombre || 'mascota';
      const tipo = this.tipoQR === 'medico' ? 'Ficha Medica' : 'Emergencia';

      pdf.setFontSize(14);
      pdf.text(`QR ${tipo} - ${nombre}`, width / 2, 20, { align: 'center' });
      pdf.addImage(imgData, 'PNG', (width - imgWidth) / 2, 30, imgWidth, imgHeight);
      pdf.save(`QR-${tipo}-${nombre}.pdf`);
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      this.descargandoPDF = false;
    }
  }
}