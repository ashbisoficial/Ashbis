import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription, combineLatest, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

import jsPDF from 'jspdf';
import QRCode from 'qrcode';
import { QRCodeComponent } from 'angularx-qrcode';

import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { downloadOutline, shareOutline } from 'ionicons/icons';

import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { PublicQrService } from '../services/public-qr.service';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota, Medicamento } from '../firebase/firestore';
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

  private destroy$ = new Subject<void>();
  private route = inject(ActivatedRoute);

  authenticationService = inject(AuthenticationService);
  firestoreService = inject(FirestoreService);
  private publicQrSvc = inject(PublicQrService);
  private firestore   = inject(Firestore);

  // ── Estado ──────────────────────────────────────────────────────────────
  cargando = signal(true);
  descargandoPDF = false;

  // ── Datos ───────────────────────────────────────────────────────────────
  userProfile: Models.Auth.UserProfile | null = null;
  misMascotas = signal<Mascota[]>([]);
  mascotaSeleccionada = signal<Mascota | null>(null);

  private targetMascotaId: string | null = null;
  private medicamentosSub?: Subscription;

  // ── Tipo de QR activo ───────────────────────────────────────────────────
  tipoQR: 'medico' | 'emergencia' = 'medico';
  qrFichaMedica  = '';
  qrEmergencia   = '';
  cuidadosEspecialesTexto = 'Sin indicadores especiales';

  // Logo de Ashbis, precargado como data URL para poder insertarlo en el PDF.
  private logoDataUrl: string | null = null;
  private static readonly LOGO_RATIO = 582 / 890;

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
    this.cargarLogo();

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
    this.medicamentosSub?.unsubscribe();

    if (!m.id) {
      this.generarQRs(m, []);
      return;
    }

    // Si la mascota aún no tiene tokens, los creamos ahora y actualizamos
    // el documento en Firestore antes de generar las URLs.
    this.ensureTokens(m).then(mConTokens => {
      this.mascotaSeleccionada.set(mConTokens);
      this.medicamentosSub = this.firestoreService.getMedicamentosByMascota(mConTokens.id!)
        .pipe(takeUntil(this.destroy$))
        .subscribe(medicamentos => this.generarQRs(mConTokens, medicamentos));
    });
  }

  /** Garantiza que la mascota tenga ambos tokens. Si no los tiene, los crea. */
  private async ensureTokens(m: Mascota): Promise<Mascota> {
    const any = m as any;
    let carnetToken: string  = any.qrCarnetToken;
    let perdidaToken: string = any.qrPerdidaToken;
    const uid = this.userProfile?.uid;

    if (!uid || !m.id) return m;

    const updates: Record<string, string> = {};

    if (!carnetToken) {
      carnetToken = this.publicQrSvc.generateToken();
      await this.publicQrSvc.createQrToken(m.id, uid, 'carnet', carnetToken);
      updates['qrCarnetToken'] = carnetToken;
    }

    if (!perdidaToken) {
      perdidaToken = this.publicQrSvc.generateToken();
      await this.publicQrSvc.createQrToken(m.id, uid, 'perdida', perdidaToken);
      updates['qrPerdidaToken'] = perdidaToken;
    }

    if (Object.keys(updates).length) {
      await updateDoc(doc(this.firestore, `mascotas/${m.id}`), updates);
    }

    return { ...m, ...updates } as Mascota;
  }

  onMascotaChange(event: any) {
    const id = event.detail.value;
    const m = this.misMascotas().find(p => p.id === id);
    if (m) { this.targetMascotaId = id; this.seleccionarMascota(m); }
  }

  // Mapa de valores internos de indicadores → texto legible para el QR
  private static readonly INDICADORES_LABEL: Record<string, string> = {
    cuidado_otros_animales: 'Cuidado con otros animales',
    cuidado_mujeres:        'Cuidado con mujeres',
    cuidado_hombres:        'Cuidado con hombres',
    cuidado_ninos:          'Cuidado con niños',
    cuidado_misma_especie:  'Cuidado con su misma especie',
    necesita_compania:      'Necesita compañía constante',
    temeroso:               'Es temeroso/a',
    agresivo:               'Es agresivo/a',
    ninguno:                ''
  };

  // ── Generar QRs ────────────────────────────────────────────────────────
  generarQRs(mascota: Mascota, medicamentos: Medicamento[] = []) {
    if (!this.userProfile) return;

    const user = this.userProfile;
    const m: any = mascota;
    const telefono = user.telefono || '';
    const nombreDueno = `${user.nombre || ''} ${user.apellido || ''}`.trim();

    // QR Médico: URL al carnet público completo
    const baseUrl = window.location.origin;


    if (m.qrCarnetToken) {
      this.qrFichaMedica =
        `${baseUrl}/carnet/${m.qrCarnetToken}`;
    } else {
      this.qrFichaMedica =
        `${baseUrl}/carnet/${mascota.id}`;
    }

    // ── QR Emergencia: texto estructurado y legible al escanearlo ──────────
    const hoy = new Date().toISOString().slice(0, 10);
    const medicamentosActivos = medicamentos.filter(med => !med.fechaFin || med.fechaFin >= hoy);

    // Indicadores de comportamiento → etiquetas legibles
    const rawIndicadores: string[] = m.indicadores ?? [];
    const comportamientoLegible = rawIndicadores
      .map(v => MascotaQrComponent.INDICADORES_LABEL[v] ?? v)
      .filter(Boolean);

    // Medicación activa con dosis y notas
    const medicacionLineas = medicamentosActivos.map(med => {
      let linea = `• ${med.nombre} ${med.mg} mg`;
      if (med.notas) linea += ` (${med.notas})`;
      return linea;
    });

    // Descripción física para identificar a la mascota
    const descripcionFisica = [
      m.especie,
      m.raza,
      m.color   ? `color ${m.color}` : '',
      m.peso    ? `${m.peso} kg`     : '',
      m.castrado && m.castrado !== 'No' ? 'castrado/a' : '',
    ].filter(Boolean).join(', ');

    const lineas = [
      '══ MASCOTA PERDIDA ══',
      '',
      `Nombre: ${m.nombre}`,
      `Descripción: ${descripcionFisica}`,
      m.senas ? `Señas: ${m.senas}` : '',
      `Microchip: ${m.numeroChip || 'No registrado'}`,
      '',
      '── CONTACTAR A ──',
      `Dueño/a: ${nombreDueno}`,
      `Teléfono: ${telefono || 'No disponible'}`,
      '',
    ];

    if (comportamientoLegible.length) {
      lineas.push('── COMPORTAMIENTO ──');
      comportamientoLegible.forEach(c => lineas.push(`• ${c}`));
      lineas.push('');
    }

    if (medicacionLineas.length) {
      lineas.push('── MEDICACIÓN ACTIVA ──');
      lineas.push('⚠ Esta mascota necesita medicación:');
      medicacionLineas.forEach(l => lineas.push(l));
      lineas.push('');
    }

    if (m.notas) {
      lineas.push('── CUIDADOS Y NOTAS ──');
      lineas.push(m.notas);
      lineas.push('');
    }

    lineas.push('══════════════════════');

    if (m.qrPerdidaToken) {

        this.qrEmergencia =
          `${baseUrl}/perdida/${m.qrPerdidaToken}`;

      } else {

        this.qrEmergencia = lineas
          .filter(l => l !== null && l !== undefined)
          .join('\n')
          .trim();

      }
    // Texto plano para el PDF (sin caracteres de borde)
    this.cuidadosEspecialesTexto = [
      comportamientoLegible.join(', ') || 'Sin indicadores de comportamiento especiales',
      medicamentosActivos.length
        ? `Medicación: ${medicamentosActivos.map(med => `${med.nombre} ${med.mg} mg`).join(', ')}`
        : '',
      m.notas ? `Notas del dueño: ${m.notas}` : ''
    ].filter(Boolean).join(' · ');
  }

  // ── Logo de Ashbis (precargado como data URL para el PDF) ────────────────
  private async cargarLogo(): Promise<void> {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width  = img.naturalWidth  || 890;
          canvas.height = img.naturalHeight || 582;
          canvas.getContext('2d')!.drawImage(img, 0, 0);
          this.logoDataUrl = canvas.toDataURL('image/png');
        } catch (e) {
          console.warn('Canvas tainted al cargar logo:', e);
          this.logoDataUrl = null;
        }
        resolve();
      };
      img.onerror = () => { this.logoDataUrl = null; resolve(); };
      img.src = 'assets/img/logo_ashbis_pdf.png';
    });
  }

  // ── Encabezado de marca, común a ambas plantillas de PDF ─────────────────
  private dibujarEncabezado(pdf: jsPDF, tituloDerecha: string): number {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 20;
    const rojo: [number, number, number] = [139, 8, 8];
    const gris: [number, number, number] = [110, 110, 110];
    let y = 18;

    if (this.logoDataUrl) {
      const logoW = 24;
      const logoH = logoW * MascotaQrComponent.LOGO_RATIO;
      pdf.addImage(this.logoDataUrl, 'PNG', marginX, y - 7, logoW, logoH);
    }

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...rojo);
    pdf.text(tituloDerecha, pageWidth - marginX, y, { align: 'right' });

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...gris);
    pdf.text('Generado con Ashbis', pageWidth - marginX, y + 6, { align: 'right' });

    y += 18;
    pdf.setDrawColor(...rojo);
    pdf.setLineWidth(0.8);
    pdf.line(marginX, y, pageWidth - marginX, y);
    return y + 12;
  }

  private dibujarPiePagina(pdf: jsPDF): void {
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const marginX = 20;
    const footerY = pageHeight - 15;

    pdf.setDrawColor(225, 225, 225);
    pdf.setLineWidth(0.3);
    pdf.line(marginX, footerY - 7, pageWidth - marginX, footerY - 7);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(140, 140, 140);
    pdf.text(`Generado el ${new Date().toLocaleDateString('es-CL')}`, marginX, footerY);
    pdf.text('Ashbis', pageWidth - marginX, footerY, { align: 'right' });
  }

  // ── PDF: Ficha Médica ─────────────────────────────────────────────────
  private async generarPdfFichaMedica(mascota: Mascota): Promise<void> {
    const m: any = mascota;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 20;
    const rojo: [number, number, number] = [139, 8, 8];

    let y = this.dibujarEncabezado(pdf, 'Ficha Veterinaria');

    pdf.setTextColor(25, 25, 25);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(22);
    pdf.text(m.nombre || 'Mascota', marginX, y);
    y += 12;

    const detalles: [string, string][] = [
      ['Especie', m.especie || '-'],
      ['Raza', m.raza || '-'],
      ['Sexo', m.sexo || '-'],
      ['Color', m.color || '-'],
      ['Número de chip', m.numeroChip || 'No registrado']
    ];
    pdf.setFontSize(11);
    for (const [label, valor] of detalles) {
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(70, 70, 70);
      pdf.text(`${label}:`, marginX, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40, 40, 40);
      pdf.text(String(valor), marginX + 45, y);
      y += 7;
    }

    y += 8;

    // QR generado directamente desde el texto, sin depender del DOM
    try {
      const qrDataUrl = await QRCode.toDataURL(this.qrFichaMedica, { errorCorrectionLevel: 'M', width: 300, margin: 2 });
      const qrSize = 60;
      pdf.addImage(qrDataUrl, 'PNG', (pageWidth - qrSize) / 2, y, qrSize, qrSize);
      y += qrSize + 8;
    } catch { /* si falla la generación del QR, se omite del PDF */ }

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.setTextColor(90, 90, 90);
    pdf.text('Escanea para ver el historial veterinario completo', pageWidth / 2, y, { align: 'center' });
    y += 6;
    pdf.setFontSize(8);
    pdf.setTextColor(130, 130, 130);
    pdf.text(this.qrFichaMedica, pageWidth / 2, y, { align: 'center' });

    const nombreDueno = `${this.userProfile?.nombre || ''} ${this.userProfile?.apellido || ''}`.trim();
    if (nombreDueno) {
      y += 14;
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setTextColor(...rojo);
      pdf.text('Dueño/a:', marginX, y);
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(40, 40, 40);
      pdf.text(nombreDueno, marginX + 22, y);
    }

    this.dibujarPiePagina(pdf);
    pdf.save(`Ficha-Medica-${m.nombre || 'mascota'}.pdf`);
  }

  // ── PDF: QR de Emergencia ─────────────────────────────────────────────
  private async generarPdfEmergencia(mascota: Mascota): Promise<void> {
    const m: any = mascota;
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const marginX = 20;
    const rojo: [number, number, number] = [139, 8, 8];
    const grisOscuro: [number, number, number] = [40, 40, 40];
    const gris: [number, number, number] = [80, 80, 80];

    let y = this.dibujarEncabezado(pdf, 'Ficha de emergencia');

    // Banda roja de alerta
    pdf.setFillColor(...rojo);
    pdf.rect(0, y - 2, pageWidth, 12, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(12);
    pdf.setTextColor(255, 255, 255);
    pdf.text('🐾  SI ENCONTRASTE A ESTA MASCOTA, POR FAVOR CONTÁCTAME', pageWidth / 2, y + 7, { align: 'center' });
    y += 20;

    // Nombre grande
    pdf.setTextColor(...rojo);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(26);
    pdf.text(m.nombre || 'Mascota', marginX, y);
    y += 10;

    // Descripción física
    const descripcion = [
      m.especie,
      m.raza,
      m.color   ? `Color: ${m.color}`  : '',
      m.peso    ? `Peso: ${m.peso} kg` : '',
      m.castrado && m.castrado !== 'No' ? 'Castrado/a' : '',
    ].filter(Boolean).join('  ·  ');
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(11);
    pdf.setTextColor(...gris);
    pdf.text(descripcion, marginX, y);
    y += 7;

    if (m.senas) {
      const lineasSenas: string[] = pdf.splitTextToSize(`Señas: ${m.senas}`, pageWidth - marginX * 2);
      pdf.text(lineasSenas, marginX, y);
      y += lineasSenas.length * 5.5;
    }

    if (m.numeroChip) {
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(100, 100, 100);
      pdf.text(`Microchip: ${m.numeroChip}`, marginX, y);
      y += 8;
    } else {
      y += 4;
    }

    // Sección de contacto
    y += 4;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(11);
    pdf.setTextColor(...rojo);
    pdf.text('CONTACTAR A:', marginX, y);
    y += 7;

    const nombreDueno = `${this.userProfile?.nombre || ''} ${this.userProfile?.apellido || ''}`.trim() || 'Sin nombre';
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(13);
    pdf.setTextColor(...grisOscuro);
    pdf.text(nombreDueno, marginX, y);
    y += 8;

    // Teléfono grande y destacado
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...rojo);
    pdf.text(this.userProfile?.telefono || 'Teléfono no disponible', marginX, y);
    y += 14;

    // Comportamiento
    const rawIndicadores: string[] = m.indicadores ?? [];
    const comportLegible = rawIndicadores
      .map((v: string) => MascotaQrComponent.INDICADORES_LABEL[v] ?? v)
      .filter(Boolean);

    if (comportLegible.length) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...rojo);
      pdf.text('COMPORTAMIENTO:', marginX, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...grisOscuro);
      comportLegible.forEach((c: string) => {
        pdf.text(`• ${c}`, marginX + 3, y);
        y += 6;
      });
      y += 4;
    }

    // Medicación activa
    const hoy = new Date().toISOString().slice(0, 10);
    // Reconstruct from the stored cuidadosEspecialesTexto to get medication info
    // We parse from the QR text since we don't store medicamentos separately here
    const hayMedicacion = this.qrEmergencia.includes('MEDICACIÓN ACTIVA');
    if (hayMedicacion) {
      pdf.setFillColor(255, 245, 245);
      pdf.rect(marginX - 2, y - 4, pageWidth - marginX * 2 + 4, 8, 'F');
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...rojo);
      pdf.text('⚠  NECESITA MEDICACIÓN — VER INFORMACIÓN DE CONTACTO', marginX, y + 2);
      y += 12;
    }

    if (m.notas) {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.setTextColor(...rojo);
      pdf.text('CUIDADOS ESPECIALES:', marginX, y);
      y += 7;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.setTextColor(...grisOscuro);
      const lineasNotas: string[] = pdf.splitTextToSize(m.notas, pageWidth - marginX * 2 - 3);
      pdf.text(lineasNotas, marginX + 3, y);
      y += lineasNotas.length * 5.5 + 6;
    }

    // QR centrado
    y += 4;
    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.3);
    pdf.line(marginX, y, pageWidth - marginX, y);
    y += 8;

    try {
      const qrDataUrl = await QRCode.toDataURL(this.qrEmergencia, { errorCorrectionLevel: 'H', width: 300, margin: 2 });
      const qrSize = 50;
      const qrX = (pageWidth - qrSize) / 2;
      pdf.addImage(qrDataUrl, 'PNG', qrX, y, qrSize, qrSize);

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      pdf.setTextColor(110, 110, 110);
      pdf.text('Escanea para ver todos los datos de esta mascota', pageWidth / 2, y + qrSize + 6, { align: 'center' });
    } catch { /* no hay QR en el PDF, pero el resto sí aparece */ }

    this.dibujarPiePagina(pdf);
    pdf.save(`Emergencia-${m.nombre || 'mascota'}.pdf`);
  }

  // ── Descargar PDF ───────────────────────────────────────────────────────
  async descargarPDF() {
    const mascota = this.mascotaSeleccionada();
    if (!mascota) return;

    this.descargandoPDF = true;
    try {
      if (this.tipoQR === 'medico') {
        await this.generarPdfFichaMedica(mascota);
      } else {
        await this.generarPdfEmergencia(mascota);
      }
    } catch (error) {
      console.error('Error generando PDF:', error);
    } finally {
      this.descargandoPDF = false;
    }
  }
}