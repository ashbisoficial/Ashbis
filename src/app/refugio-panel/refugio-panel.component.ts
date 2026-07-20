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
  addOutline, cashOutline, chatbubblesOutline, documentTextOutline, medkitOutline, pawOutline,
  peopleOutline, statsChartOutline, trashOutline,
} from 'ionicons/icons';
import { catchError, combineLatest, of, Subject, takeUntil } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota, VeterinariaFavorita } from '../firebase/firestore';
import { Models } from '../models/models';
import { SecurityService } from '../services/security.service';

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
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  refugioUid = '';
  /** true si quien mira el panel es la cuenta dueña del refugio (no un colaborador). */
  esDueno = false;
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

  // ── Estadísticas (solo lectura) ─────────────────────────────────────────
  publicacionesActivas = computed(() => this.publicaciones().filter(p => p.activa).length);
  adopcionesConcretadas = computed(() =>
    this.transferencias().filter(t => t.tipo === 'adopcion' && t.estado === 'aceptada').length
  );
  hogaresTemporalesActivos = computed(() =>
    this.transferencias().filter(t => t.tipo === 'hogar_temporal' && t.estado === 'aceptada').length
  );
  transferenciasPendientes = computed(() =>
    this.transferencias().filter(t => t.estado === 'pendiente').length
  );
  balanceFinanciero = computed(() => {
    const movs = this.movimientos();
    const ingresos = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
    const gastos = movs.filter(m => m.tipo === 'gasto').reduce((s, m) => s + m.monto, 0);
    return ingresos - gastos;
  });

  constructor() {
    addIcons({
      addOutline, cashOutline, chatbubblesOutline, documentTextOutline, medkitOutline, pawOutline,
      peopleOutline, statsChartOutline, trashOutline,
    });
  }

  ngOnInit(): void {
    this.refugioUid = this.route.snapshot.paramMap.get('refugioUid')!;
    if (!this.refugioUid) return;

    this.esDueno = this.auth.getCurrentUser()?.uid === this.refugioUid;

    this.fs.getDocument(`usuarios/${this.refugioUid}`)
      .then(perfil => this.nombreRefugio.set(perfil?.nombreRefugio?.trim() || 'Refugio'))
      .catch(() => this.errorPermisos.set(true));

    const conFallback = <T>(obs$: import('rxjs').Observable<T[]>) =>
      obs$.pipe(catchError(() => { this.errorPermisos.set(true); return of<T[]>([]); }));

    combineLatest([
      conFallback(this.fs.getUserPetsPropios(this.refugioUid)),
      conFallback(this.fs.getVeterinariasFavoritasByUsuario(this.refugioUid)),
      conFallback(this.fs.getMiembrosEquipo(this.refugioUid)),
      conFallback(this.fs.getPublicacionesByUsuario(this.refugioUid)),
      conFallback(this.fs.getTransferenciasEnviadas(this.refugioUid)),
      conFallback(this.fs.getMovimientosFinancieros(this.refugioUid)),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([mascotas, vets, miembros, publicaciones, transferencias, movimientos]) => {
        this.mascotas.set(mascotas ?? []);
        this.veterinarias.set(vets ?? []);
        this.miembros.set(miembros ?? []);
        this.publicaciones.set(publicaciones ?? []);
        this.transferencias.set(transferencias ?? []);
        this.movimientos.set(movimientos ?? []);
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

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
