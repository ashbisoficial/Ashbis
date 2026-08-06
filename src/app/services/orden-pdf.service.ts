import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';

export interface DatosClinicaPdf {
  nombreClinica?: string | null;
  direccionNegocio?: string | null;
  telefonoNegocio?: string | null;
  nombreVeterinario: string;
  numeroRegistroProfesional?: string | null;
  logoUrl?: string | null;
  timbreUrl?: string | null;
  firmaUrl?: string | null;
}

export interface DatosPacientePdf {
  nombre: string;
  especie?: string;
  raza?: string;
  sexo?: string;
  edad?: number;
  peso?: number;
  color?: string;
  numeroChip?: string;
}

export interface DatosOrdenPdf {
  entradaId: string;
  tipoLabel: string;
  campos: { label: string; valor: string }[];
  fecha: Date;
}

const ROJO_ASHBIS: [number, number, number] = [139, 8, 8];
const GRIS_FONDO: [number, number, number] = [240, 240, 240];

/**
 * Arma la orden clínica en PDF que se guarda junto a cada entrada del
 * historial médico cargada por un veterinario (ver mascota-detalle y
 * firestore.ts → agregarEntradaHistorialConPdf). Corre 100% en el
 * navegador con jsPDF — no hay Cloud Function de por medio, así que no
 * hace falta redeploy de functions para esta parte.
 */
@Injectable({ providedIn: 'root' })
export class OrdenPdfService {

  async generar(clinica: DatosClinicaPdf, paciente: DatosPacientePdf, orden: DatosOrdenPdf): Promise<Blob> {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const marginX = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    // ── Encabezado: clínica + logo ─────────────────────────────────────────
    if (clinica.logoUrl) {
      const dataUrl = await this.urlToDataUrlSeguro(clinica.logoUrl);
      if (dataUrl) this.addImageSeguro(doc, dataUrl, pageWidth - marginX - 25, y, 25, 25);
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text((clinica.nombreClinica || 'Clínica veterinaria').toUpperCase(), marginX, y + 5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    let yHeader = y + 11;
    if (clinica.direccionNegocio) { doc.text(`Dirección: ${clinica.direccionNegocio}`, marginX, yHeader); yHeader += 5; }
    if (clinica.telefonoNegocio) { doc.text(`Tel: ${clinica.telefonoNegocio}`, marginX, yHeader); yHeader += 5; }

    y = Math.max(yHeader, y + 28) + 4;
    doc.setDrawColor(...ROJO_ASHBIS);
    doc.setLineWidth(0.6);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 9;

    // ── Título de la orden ──────────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...ROJO_ASHBIS);
    doc.text(orden.tipoLabel.toUpperCase(), pageWidth / 2, y, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    y += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(`N° de orden: ${orden.entradaId.slice(0, 8).toUpperCase()}`, marginX, y);
    const hora = orden.fecha.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    doc.text(`Fecha: ${orden.fecha.toLocaleDateString('es-CL')}  Hora: ${hora}`, pageWidth - marginX, y, { align: 'right' });
    y += 9;

    // ── Datos del paciente ───────────────────────────────────────────────────
    y = this.seccionTitulo(doc, 'DATOS DEL PACIENTE', marginX, y, pageWidth);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.text(
      `Nombre: ${paciente.nombre}    Especie: ${paciente.especie || '—'}    Raza: ${paciente.raza || '—'}    Sexo: ${paciente.sexo || '—'}`,
      marginX, y
    );
    y += 6;
    const linea2 = [
      paciente.edad != null ? `Edad: ${paciente.edad} años` : null,
      paciente.peso != null ? `Peso: ${paciente.peso} kg` : null,
      paciente.color ? `Color: ${paciente.color}` : null,
      paciente.numeroChip ? `N° chip: ${paciente.numeroChip}` : null,
    ].filter(Boolean).join('    ');
    if (linea2) { doc.text(linea2, marginX, y); y += 6; }
    y += 4;

    // ── Campos de la orden (motivo/diagnóstico/tratamiento/observaciones,
    //    ya con la etiqueta que corresponde al tipo elegido) ────────────────
    for (const campo of orden.campos) {
      if (y > pageHeight - 40) { doc.addPage(); y = 20; }
      y = this.seccionTitulo(doc, campo.label.toUpperCase(), marginX, y, pageWidth);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      const lineas = doc.splitTextToSize(campo.valor, pageWidth - marginX * 2) as string[];
      doc.text(lineas, marginX, y);
      y += lineas.length * 5 + 6;
    }

    // ── Firma, timbre y datos del veterinario ────────────────────────────────
    const alturaFirma = 40;
    if (y > pageHeight - alturaFirma) { doc.addPage(); y = 20; }
    y = Math.max(y, pageHeight - alturaFirma);

    doc.setDrawColor(180, 180, 180);
    doc.line(marginX, y, marginX + 75, y);
    y += 5;
    doc.setFontSize(9);
    doc.text('Firma y sello del médico veterinario', marginX, y);
    y += 5;
    doc.text(`Nombre: ${clinica.nombreVeterinario}`, marginX, y);
    if (clinica.numeroRegistroProfesional) {
      y += 5;
      doc.text(`N° registro profesional: ${clinica.numeroRegistroProfesional}`, marginX, y);
    }

    const ySello = y - 22;
    if (clinica.firmaUrl) {
      const dataUrl = await this.urlToDataUrlSeguro(clinica.firmaUrl);
      if (dataUrl) this.addImageSeguro(doc, dataUrl, marginX + 85, ySello, 35, 18);
    }
    if (clinica.timbreUrl) {
      const dataUrl = await this.urlToDataUrlSeguro(clinica.timbreUrl);
      if (dataUrl) this.addImageSeguro(doc, dataUrl, marginX + 128, ySello - 5, 28, 28);
    }

    return doc.output('blob');
  }

  private seccionTitulo(doc: jsPDF, texto: string, marginX: number, y: number, pageWidth: number): number {
    doc.setFillColor(...GRIS_FONDO);
    doc.rect(marginX, y, pageWidth - marginX * 2, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text(texto, marginX + 2, y + 5);
    return y + 11;
  }

  /** jsPDF necesita el formato exacto de la imagen (PNG/JPEG/WEBP), no lo
   *  adivina solo — se lo saca del mime type que trae el dataURL. */
  private addImageSeguro(doc: jsPDF, dataUrl: string, x: number, y: number, w: number, h: number): void {
    try {
      const match = dataUrl.match(/^data:image\/(\w+);/);
      const formato = (match?.[1] || 'png').toUpperCase();
      doc.addImage(dataUrl, formato, x, y, w, h, undefined, 'FAST');
    } catch {
      // Sin esta imagen puntual el PDF igual sirve — no vale la pena
      // romper la generación completa por un logo/firma que no cargó.
    }
  }

  /** Fetch + FileReader en vez de <img>: jsPDF necesita el pixel data ya
   *  resuelto (dataURL), no una URL remota. Firebase Storage sirve las
   *  download URLs con CORS abierto, así que el fetch no debería fallar —
   *  pero si el veterinario está sin red o el archivo se borró, no vale la
   *  pena tirar abajo todo el PDF por una imagen opcional. */
  private async urlToDataUrlSeguro(url: string): Promise<string | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }
}
