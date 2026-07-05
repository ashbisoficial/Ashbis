import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { Subject, Subscription, combineLatest, takeUntil } from 'rxjs';
import { FormsModule } from '@angular/forms';

import { QRCodeComponent } from 'angularx-qrcode';

import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent,
  IonSpinner, IonCard, IonCardHeader, IonCardTitle, IonCardSubtitle,
  IonCardContent, IonButton, IonIcon, IonItem, IonLabel,
  IonSelect, IonSelectOption, IonSegment, IonSegmentButton, ToastController
} from '@ionic/angular/standalone';

import { addIcons } from 'ionicons';
import { downloadOutline, shareOutline } from 'ionicons/icons';

import { Firestore, doc, updateDoc } from '@angular/fire/firestore';
import { PublicQrService } from '../services/public-qr.service';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota, Medicamento } from '../firebase/firestore';
import { Models } from '../models/models';
import { environment } from 'src/environments/environment';

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
  private toastCtrl   = inject(ToastController);

  // ── Estado ──────────────────────────────────────────────────────────────
  cargando = signal(true);
  descargandoQR = false;

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

  // ── Validación previa a generar/descargar el QR ─────────────────────────
  // El QR en sí solo apunta a una URL con un token; lo que puede faltar es
  // la información real detrás de ese link. Si falta algo crítico para el
  // propósito de este QR, se lo decimos al usuario en vez de dejarlo confiar
  // en un QR de emergencia sin forma de contactarlo, por ejemplo.
  get camposFaltantes(): string[] {
    const m = this.mascotaSeleccionada();
    if (!m) return [];

    const faltan: string[] = [];

    if (!m.nombre) faltan.push('el nombre de la mascota');

    if (this.tipoQR === 'emergencia') {
      const tieneContacto = !!this.userProfile?.telefono || !!(this.userProfile?.nombre || this.userProfile?.apellido);
      if (!tieneContacto) faltan.push('un teléfono o nombre de contacto en tu perfil');
    }

    return faltan;
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

    // QR Médico: URL al carnet público completo.
    // Siempre la URL pública de producción: window.location.origin apunta a
    // "capacitor://localhost" (o similar) dentro de la app Android, lo cual
    // generaría un QR inescaneable desde otro teléfono.
    const baseUrl = environment.appUrl;


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
      `Nombre: ${m.nombre || 'Mascota'}`,
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
    // Texto plano para mostrar en pantalla (sin caracteres de borde)
    this.cuidadosEspecialesTexto = [
      comportamientoLegible.join(', ') || 'Sin indicadores de comportamiento especiales',
      medicamentosActivos.length
        ? `Medicación: ${medicamentosActivos.map(med => `${med.nombre} ${med.mg} mg`).join(', ')}`
        : '',
      m.notas ? `Notas del dueño: ${m.notas}` : ''
    ].filter(Boolean).join(' · ');
  }

  // ── Descargar QR como imagen JPG ────────────────────────────────────────
  // angularx-qrcode renderiza un <canvas> por defecto (elementType='canvas').
  // El mismo botón sirve para ambos tipos de QR según la pestaña activa, por
  // eso el selector se resuelve a partir de tipoQR en vez de recibirlo fijo.
  async descargarQR() {
    const mascota = this.mascotaSeleccionada();
    if (!mascota || this.camposFaltantes.length) return;

    this.descargandoQR = true;
    try {
      const selector = this.tipoQR === 'medico' ? '#qr-carnet canvas' : '#qr-perdida canvas';
      const qrCanvas = document.querySelector(selector) as HTMLCanvasElement | null;
      if (!qrCanvas) throw new Error('QR no encontrado en pantalla');

      // JPG no soporta transparencia: se dibuja sobre un fondo blanco con margen.
      const padding = 24;
      const canvas = document.createElement('canvas');
      canvas.width = qrCanvas.width + padding * 2;
      canvas.height = qrCanvas.height + padding * 2;

      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(qrCanvas, padding, padding);

      const tipoArchivo = this.tipoQR === 'medico' ? 'ficha-medica' : 'emergencia';
      const link = document.createElement('a');
      link.download = `QR-${tipoArchivo}-${mascota.nombre || 'mascota'}.jpg`;
      link.href = canvas.toDataURL('image/jpeg', 0.95);
      link.click();
    } catch (error) {
      console.error('Error descargando QR:', error);
      const toast = await this.toastCtrl.create({
        message: 'No se pudo descargar el QR. Intenta nuevamente.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
    } finally {
      this.descargandoQR = false;
    }
  }
}
