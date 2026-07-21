import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonLabel,
  IonButton,
  IonAvatar,
  IonSpinner,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { Subject, catchError, combineLatest, of, switchMap, take, takeUntil } from 'rxjs';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';
import { ConfettiService } from '../services/confetti.service';

@Component({
  selector: 'app-notificaciones',
  standalone: true,
  templateUrl: './notificaciones.component.html',
  styleUrls: ['./notificaciones.component.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonButton,
    IonAvatar,
    IonSpinner
  ]
})
export class NotificacionesComponent implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly confetti = inject(ConfettiService);
  private readonly destroy$ = new Subject<void>();

  cargando = true;
  transferenciasPendientes: Models.Transferencias.Transferencia[] = [];
  invitacionesPendientes: Models.Equipo.InvitacionEquipo[] = [];
  /** Foto de cada mascota en solicitudes pendientes, para mostrarla en la
   *  tarjeta (las transferencias no guardan la foto, solo el nombre). */
  fotosMascotas: Record<string, string | null> = {};
  /** Mensaje de error crudo de Firestore si alguna de las dos consultas
   *  falla (permission-denied, índice faltante, etc.) — sin esto, un error
   *  simplemente dejaba la lista vacía para siempre sin ninguna pista de
   *  qué pasó, indistinguible de "no tenés notificaciones". */
  errorCarga: string | null = null;

  constructor() {
    this.auth.authState$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(user => {
          const email = user?.email ?? null;
          if (!email) {
            return of([[], []] as [Models.Transferencias.Transferencia[], Models.Equipo.InvitacionEquipo[]]);
          }
          const conError = <T>(obs$: import('rxjs').Observable<T[]>) =>
            obs$.pipe(catchError(err => {
              console.error('Error cargando notificaciones:', err);
              this.errorCarga = err?.message || err?.code || 'Error desconocido';
              return of<T[]>([]);
            }));
          return combineLatest([
            conError(this.firestoreService.getTransferenciasPendientesParaMi(email)),
            conError(this.firestoreService.getInvitacionesEquipoPendientesParaMi(email))
          ]);
        })
      )
      .subscribe(([transferencias, invitaciones]) => {
        this.transferenciasPendientes = transferencias;
        this.invitacionesPendientes = invitaciones;
        this.cargando = false;
        this.cargarFotosMascotas(transferencias);
      });
  }

  private cargarFotosMascotas(transferencias: Models.Transferencias.Transferencia[]): void {
    for (const t of transferencias) {
      if (!t.mascotaId || t.mascotaId in this.fotosMascotas) continue;
      this.fotosMascotas[t.mascotaId] = null;
      this.firestoreService.getPetById(t.mascotaId)
        .pipe(take(1), takeUntil(this.destroy$))
        .subscribe(m => this.fotosMascotas[t.mascotaId] = m?.fotoUrl || null);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async aceptarSolicitud(t: Models.Transferencias.Transferencia): Promise<void> {
    const esAdopcion = t.tipo === 'adopcion';
    const alert = await this.alertCtrl.create({
      header: esAdopcion ? 'Aceptar mascota' : 'Aceptar hogar temporal',
      message: esAdopcion
        ? `${t.deNombre} te está transfiriendo a ${t.mascotaNombre}. Al aceptar, la mascota (con todo su historial) pasa a tu cuenta.`
        : `${t.deNombre} te está compartiendo el acceso a ${t.mascotaNombre}. Al aceptar, vas a poder ver y actualizar su perfil e historial, pero ${t.deNombre} sigue como dueño/a.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aceptar',
          handler: async () => {
            if (!t.id) return;
            try {
              await this.firestoreService.aceptarTransferencia(t.id);
              this.confetti.lanzar();
              await this.showToast(
                esAdopcion ? `¡${t.mascotaNombre} ahora es tuya! 🐾` : `Ya tenés acceso a ${t.mascotaNombre}. 🐾`,
                'success'
              );
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo aceptar la solicitud.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarSolicitud(t: Models.Transferencias.Transferencia): Promise<void> {
    if (!t.id) return;
    try {
      await this.firestoreService.rechazarTransferencia(t.id);
      await this.showToast('Solicitud rechazada.', 'primary');
    } catch {
      await this.showToast('No se pudo rechazar la solicitud.', 'danger');
    }
  }

  async aceptarInvitacionEquipo(inv: Models.Equipo.InvitacionEquipo): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Unirte al equipo',
      message: `${inv.refugioNombre} te invitó a operar su cuenta como ${inv.rolEquipo === 'admin' ? 'administrador/a' : 'staff'}.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aceptar',
          handler: async () => {
            if (!inv.id) return;
            try {
              await this.firestoreService.aceptarInvitacionEquipo(inv.id);
              await this.showToast(`Ahora formás parte del equipo de ${inv.refugioNombre}.`, 'success');
            } catch (error: any) {
              await this.showToast(error?.message || 'No se pudo aceptar la invitación.', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async rechazarInvitacionEquipo(inv: Models.Equipo.InvitacionEquipo): Promise<void> {
    if (!inv.id) return;
    try {
      await this.firestoreService.rechazarInvitacionEquipo(inv.id);
      await this.showToast('Invitación rechazada.', 'primary');
    } catch {
      await this.showToast('No se pudo rechazar la invitación.', 'danger');
    }
  }

  private async showToast(message: string, color: 'success' | 'danger' | 'primary'): Promise<void> {
    const t = await this.toastCtrl.create({ message, duration: 2200, color });
    await t.present();
  }
}
