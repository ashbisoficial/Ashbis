import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonBadge,
  IonSpinner,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  AlertController,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chatbubblesOutline, closeCircleOutline, shieldCheckmarkOutline, warningOutline } from 'ionicons/icons';
import { Subject, combineLatest, of, switchMap, takeUntil } from 'rxjs';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { RefugioContextService } from '../services/refugio-context.service';
import { SecurityService } from '../services/security.service';
import { Models } from '../models/models';

@Component({
  selector: 'app-publicacion-detalle',
  standalone: true,
  templateUrl: './publicacion-detalle.component.html',
  styleUrls: ['./publicacion-detalle.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonBadge,
    IonSpinner,
    IonButton,
    IonIcon,
    IonItem,
    IonLabel,
  ],
})
export class PublicacionDetalleComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly firestoreService = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly refugioCtx = inject(RefugioContextService);
  private readonly security = inject(SecurityService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  readonly etiquetasTipo: Record<Models.Publicaciones.TipoPublicacion, string> = {
    adopcion: '🐾 Adopción',
    recoleccion: '📋 Recolección',
    donacion: '💛 Donación',
    otro: '📌 Otro',
  };

  cargando = true;
  noEncontrada = false;
  publicacion: Models.Publicaciones.Publicacion | undefined;

  private miUid = '';
  soyDueno = false;
  miPostulacion: Models.Postulaciones.Postulacion | null = null;
  postulacionesRecibidas: Models.Postulaciones.Postulacion[] = [];
  enviandoPostulacion = false;

  infoRefugio: Models.RefugiosPublico.InfoPublicaRefugio | undefined;
  /** Ficha real de la mascota vinculada (si la publicación tiene
   *  mascotaId) — se prioriza sobre lo que dice la publicación para la
   *  foto y para mostrar su información pública (especie, sexo, edad...). */
  mascota: Mascota | undefined;

  constructor() {
    addIcons({ chatbubblesOutline, closeCircleOutline, shieldCheckmarkOutline, warningOutline });

    this.miUid = this.auth.getCurrentUser()?.uid ?? '';

    this.route.paramMap
      .pipe(
        takeUntil(this.destroy$),
        switchMap(params => {
          const id = params.get('id');
          if (!id) return [undefined];
          return this.firestoreService.getPublicacionById(id);
        })
      )
      .subscribe(pub => {
        this.publicacion = pub;
        this.noEncontrada = !pub;
        this.cargando = false;
        this.mascota = undefined;
        if (pub?.id) {
          this.cargarPostulaciones(pub);
          this.cargarInfoRefugio(pub.uidAutor);
          if (pub.mascotaId) this.cargarMascota(pub.mascotaId);
        }
      });
  }

  private cargarMascota(mascotaId: string): void {
    this.firestoreService.getPetById(mascotaId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(m => this.mascota = m);
  }

  /** Foto real de la mascota si está vinculada; si no, la que tenga la
   *  publicación (puede haber sido subida aparte, ej. desde Mis Publicaciones). */
  get fotoPublicacion(): string {
    return this.mascota?.fotoUrl || this.publicacion?.fotoUrl || 'assets/img/9.jpg';
  }

  private cargarInfoRefugio(uidAutor: string): void {
    this.firestoreService.getInfoPublicaRefugio(uidAutor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(info => this.infoRefugio = info);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarPostulaciones(pub: Models.Publicaciones.Publicacion): void {
    if (!pub.id || pub.tipo !== 'adopcion' || !this.miUid) return;

    this.refugioCtx.contexto$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(ctx => {
        // ctx.todos solo incluye el uid propio cuando la cuenta es de rol
        // 'refugio' — pero desde que cualquier cuenta puede publicar una
        // mascota en adopción, hay que reconocer también al autor directo
        // de la publicación, sea o no refugio.
        this.soyDueno = pub.uidAutor === ctx.miUid || ctx.todos.includes(pub.uidAutor);

        if (this.soyDueno) {
          this.firestoreService.getPostulacionesPorPublicacion(pub.id!)
            .pipe(takeUntil(this.destroy$))
            .subscribe(ps => this.postulacionesRecibidas = ps);
        } else {
          this.firestoreService.getMisPostulaciones(this.miUid)
            .pipe(takeUntil(this.destroy$))
            .subscribe(ps => {
              this.miPostulacion = ps.find(p => p.publicacionId === pub.id && p.estado === 'pendiente') ?? null;
            });
        }
      });
  }

  async postular(): Promise<void> {
    const pub = this.publicacion;
    if (!pub?.id || this.enviandoPostulacion) return;
    const alert = await this.alertCtrl.create({
      header: `Postular a adoptar a ${pub.titulo}`,
      message: 'El refugio va a ver tu postulación y, si le interesa, se abre un chat directo con vos para coordinar.',
      inputs: [
        { name: 'mensaje', type: 'textarea', placeholder: 'Contale al refugio por qué querés adoptarla (opcional)' },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Postular',
          handler: async (data) => {
            this.enviandoPostulacion = true;
            try {
              const mensaje = data.mensaje ? this.security.sanitizeText(data.mensaje, 500) : undefined;
              await this.firestoreService.crearPostulacion(
                pub.id!, pub.mascotaId, pub.titulo, pub.uidAutor, mensaje
              );
              await this.mostrarToast('¡Postulación enviada!', 'success');
            } catch (err: any) {
              await this.mostrarToast(err?.message || 'No se pudo enviar la postulación.', 'danger');
            } finally {
              this.enviandoPostulacion = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async cancelarMiPostulacion(): Promise<void> {
    if (!this.miPostulacion?.id) return;
    try {
      await this.firestoreService.cancelarPostulacion(this.miPostulacion.id);
      await this.mostrarToast('Postulación cancelada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo cancelar. Intenta nuevamente.', 'danger');
    }
  }

  async aceptarPostulacion(p: Models.Postulaciones.Postulacion): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Aceptar postulación',
      message: `Se abre un chat directo con ${p.postulanteNombre} para coordinar la adopción. Todavía no transfiere la mascota — eso lo hacés después, ya charlando.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aceptar y abrir chat',
          handler: async () => {
            try {
              const chatId = await this.firestoreService.aceptarPostulacion(p);
              this.router.navigate(['/tabs/chat-directo', chatId]);
            } catch (err: any) {
              await this.mostrarToast(err?.message || 'No se pudo aceptar la postulación.', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async rechazarPostulacion(p: Models.Postulaciones.Postulacion): Promise<void> {
    if (!p.id) return;
    try {
      await this.firestoreService.rechazarPostulacion(p.id);
      await this.mostrarToast('Postulación rechazada.', 'success');
    } catch {
      await this.mostrarToast('No se pudo rechazar. Intenta nuevamente.', 'danger');
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }
}
