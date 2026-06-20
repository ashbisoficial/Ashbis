import { Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { IonContent, IonSpinner, IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { callOutline, logoWhatsapp, mailOutline, shareOutline } from 'ionicons/icons';
import { PublicQrService } from '../services/public-qr.service';
import {
  Firestore, doc, getDoc, collection, getDocs, query, orderBy
} from '@angular/fire/firestore';

@Component({
  selector: 'app-mascota-perdida',
  templateUrl: './mascota-perdida.page.html',
  styleUrls: ['./mascota-perdida.page.scss'],
  standalone: true,
  imports: [CommonModule, IonContent, IonSpinner, IonButton, IonIcon]
})
export class MascotaPerdidaPage implements OnInit {

  private route         = inject(ActivatedRoute);
  private firestore     = inject(Firestore);
  private publicQrSvc   = inject(PublicQrService);

  mascota:   any = null;
  dueno:     any = null;
  medicamentosActivos: any[] = [];

  cargando = true;
  error    = false;

  // Mapa de indicadores internos → etiqueta legible
  private static readonly INDICADORES: Record<string, string> = {
    cuidado_otros_animales: 'Precaución con otros animales',
    cuidado_mujeres:        'Precaución con mujeres',
    cuidado_hombres:        'Precaución con hombres',
    cuidado_ninos:          'Precaución con niños',
    cuidado_misma_especie:  'Precaución con su misma especie',
    necesita_compania:      'Necesita compañía constante',
    temeroso:               'Es temeroso/a',
    agresivo:               'Es agresivo/a',
  };

  constructor() {
    addIcons({ callOutline, logoWhatsapp, mailOutline, shareOutline });
  }

  async ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token');
    if (!token) { this.error = true; this.cargando = false; return; }

    try {
      const qrData = await this.publicQrSvc.getQrToken('perdida', token);
      if (!qrData?.mascotaId) { this.error = true; return; }
      await this.cargarDatos(qrData.mascotaId);
    } catch (e) {
      console.error('Error cargando ficha de pérdida:', e);
      this.error = true;
    } finally {
      this.cargando = false;
    }
  }

  private async cargarDatos(mascotaId: string) {
    // Mascota
    const snap = await getDoc(doc(this.firestore, `mascotas/${mascotaId}`));
    if (!snap.exists()) { this.error = true; return; }
    this.mascota = { id: snap.id, ...snap.data() };

    // Contacto público del dueño
    if (this.mascota.uidUsuario) {
      try {
        const cSnap = await getDoc(
          doc(this.firestore, `usuarios/${this.mascota.uidUsuario}/publico/contacto`)
        );
        if (cSnap.exists()) this.dueno = cSnap.data();
      } catch { /* no crítico */ }
    }

    // Medicamentos activos (solo los que todavía están vigentes)
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const medSnap = await getDocs(
        query(collection(this.firestore, `mascotas/${mascotaId}/medicamentos`),
              orderBy('fechaInicio', 'desc'))
      );
      this.medicamentosActivos = medSnap.docs
        .map(d => d.data())
        .filter(m => !m['fechaFin'] || m['fechaFin'] >= hoy);
    } catch { /* no crítico */ }
  }

  // ── Helpers para la plantilla ──────────────────────────────────────────

  get tieneAlertasMedicas(): boolean {
    const m = this.mascota;
    return !!(
      m?.alergias?.length ||
      m?.enfermedadesCronicas?.length ||
      m?.medicamentosPermanentes?.length ||
      this.medicamentosActivos.length
    );
  }

  get indicadoresLegibles(): string[] {
    return (this.mascota?.indicadores ?? [])
      .map((v: string) => MascotaPerdidaPage.INDICADORES[v] ?? v)
      .filter(Boolean);
  }

  get descripcionCompatibilidad(): string[] {
    const m = this.mascota;
    if (!m) return [];
    const items: string[] = [];
    if (m.seLlevaConPerros === true)  items.push('✅ Se lleva con perros');
    if (m.seLlevaConPerros === false) items.push('❌ No se lleva con perros');
    if (m.seLlevaConGatos  === true)  items.push('✅ Se lleva con gatos');
    if (m.seLlevaConGatos  === false) items.push('❌ No se lleva con gatos');
    if (m.seLlevaConNinos  === true)  items.push('✅ Se lleva con niños');
    if (m.seLlevaConNinos  === false) items.push('❌ No se lleva con niños');
    return items;
  }

  // ── Acciones de contacto ───────────────────────────────────────────────

  llamar() {
    const tel = this.dueno?.telefono || this.mascota?.telefonoEmergencia;
    if (tel) window.open(`tel:${tel}`);
  }

  whatsapp() {
    const tel = (this.dueno?.telefono || this.mascota?.telefonoEmergencia || '')
      .replace(/\D/g, '');
    if (!tel) return;
    const msg = encodeURIComponent(
      `Hola, encontré a ${this.mascota?.nombre ?? 'tu mascota'} y quiero ayudar.`
    );
    window.open(`https://wa.me/${tel}?text=${msg}`, '_blank');
  }

  compartir() {
    if (navigator.share) {
      navigator.share({
        title: `${this.mascota?.nombre ?? 'Mascota'} está perdida`,
        text: `Ayuda a encontrar a ${this.mascota?.nombre ?? 'esta mascota'}`,
        url: window.location.href
      });
    } else {
      navigator.clipboard?.writeText(window.location.href);
    }
  }
}