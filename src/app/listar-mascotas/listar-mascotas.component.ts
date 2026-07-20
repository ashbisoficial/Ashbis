import { Component, inject, signal, computed, OnDestroy } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';

import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonList, IonItem, IonAvatar, IonSkeletonText,
  IonButton, IonLabel, IonIcon,
  IonFab, IonFabButton,
  IonButtons, IonBackButton,
  IonSegment, IonSegmentButton
} from '@ionic/angular/standalone';

import { RefresherCustomEvent } from '@ionic/angular';
import { Auth, authState } from '@angular/fire/auth';
import { Subject, of, take, combineLatest } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { add, qrCodeOutline } from 'ionicons/icons';

type Vista = 'propias' | 'temporal';

@Component({
  selector: 'app-mis-mascotas',
  standalone: true,
  imports: [
    NgIf, NgFor, RouterLink,
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonList, IonItem, IonAvatar, IonSkeletonText,
  IonLabel, IonIcon,
  IonFab, IonFabButton,
  IonButtons, IonBackButton,
  IonSegment, IonSegmentButton
  ],
  templateUrl: './listar-mascotas.component.html',
  styleUrls: ['./listar-mascotas.component.scss'],
  providers: [DatePipe],
})
export class ListarMascotasComponent implements OnDestroy {

  private auth = inject(Auth);
  private fs = inject(FirestoreService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  loading = signal(true);
  mascotasPropias = signal<Mascota[]>([]);
  /** Mascotas donde solo soy colaborador de hogar temporal, no dueño. */
  mascotasHogarTemporal = signal<Mascota[]>([]);
  usuarioUid = signal<string | null>(null);
  vista = signal<Vista>('propias');

  mascotas = computed(() =>
    this.vista() === 'propias' ? this.mascotasPropias() : this.mascotasHogarTemporal()
  );

  constructor() {
    // Registrar iconos
    addIcons({ add, qrCodeOutline });

    // Obtener usuario + mascotas
    authState(this.auth)
      .pipe(
        switchMap(user => {
          const uid = user?.uid ?? null;
          this.usuarioUid.set(uid);
          if (!uid) return of<[Mascota[], Mascota[]]>([[], []]);
          return combineLatest([
            this.fs.getUserPets(uid),
            this.fs.getMascotasHogarTemporal(uid)
          ]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(([propias, temporal]) => {
        this.mascotasPropias.set(propias ?? []);
        this.mascotasHogarTemporal.set(temporal ?? []);
        this.loading.set(false);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, m: Mascota) => m.id;

  cambiarVista(v: Vista): void {
    this.vista.set(v);
  }

  // Refrescar listado
  doRefresh(ev: Event): void {
    const refresher = ev as RefresherCustomEvent;
    const uid = this.usuarioUid();

    if (!uid) {
      refresher.target.complete();
      return;
    }

    this.loading.set(true);

    combineLatest([
      this.fs.getUserPets(uid),
      this.fs.getMascotasHogarTemporal(uid)
    ]).pipe(take(1)).subscribe({
      next: ([propias, temporal]) => {
        this.mascotasPropias.set(propias ?? []);
        this.mascotasHogarTemporal.set(temporal ?? []);
        this.loading.set(false);
        refresher.target.complete();
      },
      error: () => {
        this.loading.set(false);
        refresher.target.complete();
      }
    });
  }

  // Navegar a perfil de mascota
  goPerfil(m: Mascota, event?: Event) {
    if (event) event.stopPropagation();

    this.router.navigate(['/tabs/perfil-mascota', m.id], {
      state: { mascota: m }
    });
  }

  // Navegar a edición
  goEditar(m: Mascota) {
    this.router.navigate(
      ['/tabs/mascota-editar', m.id, 'editar'],
      { state: { mascota: m } }
    );
  }

  // Ver QR de la mascota
  verQrMascota(m: Mascota, event?: Event) {
    if (event) event.stopPropagation();
    
    this.router.navigate(
      ['/tabs/mascota-qr'],
      { queryParams: { mascotaId: m.id } }
    );
  }
}
