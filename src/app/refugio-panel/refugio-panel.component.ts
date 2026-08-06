import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  AlertController,
  IonAvatar,
  IonBackButton,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonCol,
  IonContent,
  IonGrid,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRow,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, cashOutline, chatbubblesOutline, checkmarkCircleOutline, documentTextOutline,
  medkitOutline, pawOutline, peopleOutline, shieldCheckmarkOutline, statsChartOutline, trashOutline,
} from 'ionicons/icons';
import { catchError, combineLatest, of, Subject, take, takeUntil } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota, VeterinariaFavorita } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';
import { PreferenciasService } from '../services/preferencias.service';
import { RefugioContextService } from '../services/refugio-context.service';

@Component({
  selector: 'app-refugio-panel',
  standalone: true,
  templateUrl: './refugio-panel.component.html',
  styleUrls: ['./refugio-panel.component.scss'],
  imports: [
    CommonModule, RouterLink,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent,
    IonItem, IonLabel, IonIcon, IonButton, IonList, IonAvatar, IonSpinner,
    IonGrid, IonRow, IonCol,
  ],
})
export class RefugioPanelComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly security = inject(SecurityService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly refugioCtx = inject(RefugioContextService);
  private readonly destroy$ = new Subject<void>();

  refugioUid = '';
  /** true si quien mira el panel es la cuenta dueña del refugio (no un colaborador). */
  esDueno = false;
  private miUid: string | null = null;
  /** Dueño o CUALQUIER miembro del equipo (admin o staff) — mismo criterio
   *  que puedeOperarComoRefugio() en firestore.rules. Antes varias acciones
   *  del panel (transferencias, invitar/quitar del equipo) solo miraban
   *  esDueno, así que un admin invitado no dueño no podía usarlas desde acá
   *  aunque las reglas se lo permitieran. */
  esMiembroDelEquipo = computed(() => {
    if (this.esDueno) return true;
    return this.miembros().some(m => m.uid === this.miUid);
  });
  /** Dueño o miembro con rolEquipo === 'admin' — mismo criterio que
   *  esAdminDelRefugio() en firestore.rules (invitar/quitar gente del
   *  equipo, cancelar invitaciones). Un "staff" puede operar la cuenta pero
   *  no gestionar el equipo. */
  esAdminEquipo = computed(() => {
    if (this.esDueno) return true;
    return this.miembros().some(m => m.uid === this.miUid && m.rolEquipo === 'admin');
  });
  nombreRefugio = signal('Refugio');
  cargando = signal(true);
  /** Si alguna consulta falló por permisos (típico de un deploy a medio
   *  terminar: reglas viejas + frontend nuevo), avisamos en vez de dejar
   *  el spinner girando para siempre. */
  errorPermisos = signal(false);

  mascotas = signal<Mascota[]>([]);
  veterinarias = signal<VeterinariaFavorita[]>([]);
  miembros = signal<Models.Equipo.MiembroEquipo[]>([]);
  publicaciones = signal<Models.Publicaciones.Publicacion[]>([]);
  transferencias = signal<Models.Transferencias.Transferencia[]>([]);
  movimientos = signal<Models.Finanzas.Movimiento[]>([]);
  invitacionesEquipoEnviadas = signal<Models.Equipo.InvitacionEquipo[]>([]);
  /** id de la transferencia que se está reenviando ahora mismo (deshabilita
   *  su botón mientras corre, para evitar reenvíos dobles por doble tap). */
  reenviando = signal<string | null>(null);

  // ── Verificación (antifraude) ────────────────────────────────────────────
  verificado = signal(false);
  documentoLegalUrl = signal<string | null>(null);
  subiendoDocumento = signal(false);

  // ── Estadísticas (solo lectura) ─────────────────────────────────────────
  publicacionesActivas = computed(() => this.publicaciones().filter(p => p.activa).length);
  adopcionesConcretadas = computed(() =>
    this.transferencias().filter(t => t.tipo === 'adopcion' && t.estado === 'aceptada').length
  );
  hogaresTemporalesActivos = computed(() =>
    this.transferencias().filter(t => t.tipo === 'hogar_temporal' && t.estado === 'aceptada').length
  );
  transferenciasPendientesLista = computed(() =>
    this.transferencias().filter(t => t.estado === 'pendiente')
  );
  transferenciasPendientes = computed(() => this.transferenciasPendientesLista().length);
  balanceFinanciero = computed(() => {
    const movs = this.movimientos();
    const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const gastos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
    return ingresos - gastos;
  });

  constructor() {
    addIcons({
      addOutline, cashOutline, chatbubblesOutline, checkmarkCircleOutline, documentTextOutline,
      medkitOutline, pawOutline, peopleOutline, shieldCheckmarkOutline, statsChartOutline, trashOutline,
    });
  }

  ngOnInit(): void {
    const uidParam = this.route.snapshot.paramMap.get('refugioUid');
    if (uidParam) {
      this.cargarPanel(uidParam);
      return;
    }

    // Se entró desde el tab "Refugio" del nav (sin uid en la URL): Ionic
    // siempre navega a la raíz estática del tab (/tabs/refugio-panel, sin
    // el uid) — ignora cualquier href dinámico del tab-button — así que acá
    // resolvemos a qué refugio corresponde, igual que RefugioContextService
    // .irARefugio, y navegamos a la ruta con el uid ya resuelto.
    this.refugioCtx.contexto$()
      .pipe(take(1))
      .subscribe(ctx => {
        if (!ctx.todos.length) {
          this.cargando.set(false);
          this.errorPermisos.set(true);
          return;
        }
        if (ctx.todos.length === 1) {
          this.router.navigate(['/tabs/refugio-panel', ctx.todos[0]], { replaceUrl: true });
        } else {
          this.refugioCtx.irARefugio(ctx.todos, '/tabs/refugio-panel');
        }
      });
  }

  private cargarPanel(uid: string): void {
    this.refugioUid = uid;
    this.miUid = this.auth.getCurrentUser()?.uid ?? null;
    this.esDueno = this.miUid === uid;

    this.fs.getDocument(`usuarios/${uid}`)
      .then(perfil => {
        this.nombreRefugio.set(perfil?.nombreRefugio?.trim() || 'Refugio');
        this.verificado.set(perfil?.verificado === true);
        this.documentoLegalUrl.set(perfil?.documentoLegalUrl ?? null);
      })
      .catch(() => this.errorPermisos.set(true));

    const conFallback = <T>(obs$: import('rxjs').Observable<T[]>) =>
      obs$.pipe(catchError(() => { this.errorPermisos.set(true); return of<T[]>([]); }));

    combineLatest([
      conFallback(this.fs.getUserPetsPropios(uid)),
      conFallback(this.fs.getVeterinariasFavoritasByUsuario(uid)),
      conFallback(this.fs.getMiembrosEquipo(uid)),
      conFallback(this.fs.getPublicacionesByUsuario(uid)),
      conFallback(this.fs.getTransferenciasEnviadas(uid)),
      conFallback(this.fs.getMovimientosFinancieros(uid)),
      conFallback(this.fs.getInvitacionesEquipoEnviadas(uid)),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([mascotas, vets, miembros, publicaciones, transferencias, movimientos, invitaciones]) => {
        this.mascotas.set(mascotas ?? []);
        this.veterinarias.set(vets ?? []);
        this.miembros.set(miembros ?? []);
        this.publicaciones.set(publicaciones ?? []);
        this.transferencias.set(transferencias ?? []);
        this.movimientos.set(movimientos ?? []);
        this.invitacionesEquipoEnviadas.set((invitaciones ?? []).filter(i => i.estado === 'pendiente'));
        this.cargando.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, m: { id?: string }) => m.id;

  verMascota(m: Mascota): void {
    this.router.navigate(['/tabs/perfil-mascota', m.id], { state: { mascota: m } });
  }

  verPublicacion(p: Models.Publicaciones.Publicacion): void {
    this.router.navigate(['/tabs/publicacion', p.id]);
  }

  /** Abre el selector de archivo solo si la cámara/galería está habilitada
   *  en Configuración → Permisos (preferencia propia de Ashbis, no el
   *  permiso real del navegador). */
  abrirSelectorArchivo(input: HTMLInputElement): void {
    if (!this.preferencias.camaraHabilitada) {
      this.mostrarToast('Activa la cámara en Configuración → Permisos para subir archivos.', 'danger');
      return;
    }
    input.click();
  }

  async subirDocumentoVerificacion(event: Event): Promise<void> {
    if (!this.esDueno) return;
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const error = this.security.validateFile(file, {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxMb: 15,
    });
    if (error) {
      await this.mostrarToast(error, 'danger');
      (event.target as HTMLInputElement).value = '';
      return;
    }

    this.subiendoDocumento.set(true);
    try {
      const url = await this.fs.uploadDocumentoLegalRefugio(this.refugioUid, file);
      this.documentoLegalUrl.set(url);
      await this.mostrarToast('Documento enviado. El equipo de Ashbis lo va a revisar.', 'success');
    } catch {
      await this.mostrarToast('No se pudo subir el documento. Intenta nuevamente.', 'danger');
    } finally {
      this.subiendoDocumento.set(false);
      (event.target as HTMLInputElement).value = '';
    }
  }

  async agregarVeterinaria(): Promise<void> {
    if (!this.esDueno) return;
    const alert = await this.alertCtrl.create({
      header: 'Agregar veterinaria',
      message: 'Se guarda como veterinaria asociada a este refugio.',
      inputs: [
        { name: 'nombre', type: 'text', placeholder: 'Nombre de la veterinaria' },
        { name: 'direccion', type: 'text', placeholder: 'Dirección' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Agregar',
          handler: async (data) => {
            const nombre = this.security.sanitizeText(data.nombre || '', 200);
            const direccion = this.security.sanitizeText(data.direccion || '', 500);
            if (!nombre || !direccion) {
              await this.mostrarToast('Completa nombre y dirección.', 'danger');
              return false;
            }
            try {
              await this.fs.addVeterinariaFavorita(this.refugioUid, {
                placeId: `manual-${uuidv4()}`,
                nombre,
                direccion,
                lat: 0,
                lng: 0,
              });
              return true;
            } catch {
              await this.mostrarToast('No se pudo agregar. Intenta nuevamente.', 'danger');
              return false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async quitarVeterinaria(v: VeterinariaFavorita): Promise<void> {
    if (!v.id || !this.esDueno) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar veterinaria',
      message: `¿Quitar a "${v.nombre}" de las veterinarias asociadas?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.fs.deleteVeterinariaFavorita(this.refugioUid, v.id!);
            } catch {
              await this.mostrarToast('No se pudo quitar. Intenta nuevamente.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  // ── Equipo del refugio (invitar/quitar): solo la cuenta dueña ────────────

  async invitarAlEquipo(): Promise<void> {
    if (!this.esAdminEquipo()) return;
    const alert = await this.alertCtrl.create({
      header: 'Invitar al equipo',
      message: 'La persona va a poder crear/editar mascotas y publicaciones en nombre de tu cuenta de refugio.',
      inputs: [
        { name: 'email', type: 'email', placeholder: 'Email de la persona' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Como staff', handler: (data) => this.enviarInvitacionEquipo(data.email, 'staff') },
        { text: 'Como admin', handler: (data) => this.enviarInvitacionEquipo(data.email, 'admin') },
      ]
    });
    await alert.present();
  }

  private async enviarInvitacionEquipo(rawEmail: string, rolEquipo: Models.Equipo.RolEquipo): Promise<void> {
    const email = this.security.sanitizeText(rawEmail || '', 200);
    if (!this.security.isValidEmail(email)) {
      await this.mostrarToast('Ingresa un email válido.', 'danger');
      return;
    }
    try {
      await this.fs.crearInvitacionEquipo(this.refugioUid, this.nombreRefugio(), email, rolEquipo);
      await this.mostrarToast('Invitación enviada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo enviar la invitación.', 'danger');
    }
  }

  async cancelarInvitacionEquipo(inv: Models.Equipo.InvitacionEquipo): Promise<void> {
    if (!inv.id || !this.esAdminEquipo()) return;
    try {
      await this.fs.cancelarInvitacionEquipo(inv.id);
      await this.mostrarToast('Invitación cancelada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo cancelar la invitación.', 'danger');
    }
  }

  async quitarMiembro(m: Models.Equipo.MiembroEquipo): Promise<void> {
    if (!this.esAdminEquipo()) return;
    const alert = await this.alertCtrl.create({
      header: 'Quitar del equipo',
      message: `¿Sacar a ${m.nombre} del equipo? Ya no va a poder operar tu cuenta.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Quitar',
          role: 'destructive',
          handler: async () => {
            try {
              await this.fs.quitarMiembroEquipo(this.refugioUid, m.uid);
              await this.mostrarToast('Se quitó del equipo.', 'success');
            } catch {
              await this.mostrarToast('No se pudo quitar del equipo.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async cancelarTransferenciaEnviada(t: Models.Transferencias.Transferencia): Promise<void> {
    if (!t.id || !this.esMiembroDelEquipo()) return;
    try {
      await this.fs.cancelarTransferencia(t.id);
      await this.mostrarToast('Transferencia cancelada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo cancelar la transferencia.', 'danger');
    }
  }

  async reenviarTransferencia(t: Models.Transferencias.Transferencia): Promise<void> {
    if (!t.id || !this.esMiembroDelEquipo() || this.reenviando()) return;
    this.reenviando.set(t.id);
    try {
      await this.fs.reenviarNotificacionTransferencia(t.id);
      await this.mostrarToast(`Se reenvió el aviso a ${t.paraEmail}.`, 'success');
    } catch (err: any) {
      await this.mostrarToast(err?.message || 'No se pudo reenviar. Intenta nuevamente.', 'danger');
    } finally {
      this.reenviando.set(null);
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
