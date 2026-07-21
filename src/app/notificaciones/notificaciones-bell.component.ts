import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { notificationsOutline } from 'ionicons/icons';
import { Subject, catchError, combineLatest, of, switchMap, takeUntil } from 'rxjs';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

@Component({
  selector: 'app-notificaciones-bell',
  standalone: true,
  templateUrl: './notificaciones-bell.component.html',
  styleUrls: ['./notificaciones-bell.component.scss'],
  imports: [CommonModule, IonButton, IonIcon]
})
export class NotificacionesBellComponent implements OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly firestoreService = inject(FirestoreService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  cantidad = 0;

  constructor() {
    addIcons({ notificationsOutline });

    this.auth.authState$
      .pipe(
        takeUntil(this.destroy$),
        switchMap(user => {
          const email = user?.email ?? null;
          if (!email) {
            return of([[], []] as [Models.Transferencias.Transferencia[], Models.Equipo.InvitacionEquipo[]]);
          }
          const conFallback = <T>(obs$: import('rxjs').Observable<T[]>) =>
            obs$.pipe(catchError(err => {
              console.error('Error cargando notificaciones (campanita):', err);
              return of<T[]>([]);
            }));
          return combineLatest([
            conFallback(this.firestoreService.getTransferenciasPendientesParaMi(email)),
            conFallback(this.firestoreService.getInvitacionesEquipoPendientesParaMi(email))
          ]);
        })
      )
      .subscribe(([transferencias, invitaciones]) => {
        this.cantidad = transferencias.length + invitaciones.length;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  irANotificaciones(): void {
    this.router.navigate(['/tabs/notificaciones']);
  }
}
