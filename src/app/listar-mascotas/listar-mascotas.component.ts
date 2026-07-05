import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgIf, NgFor, DatePipe } from '@angular/common';

import {
  IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent,
  IonList, IonItem, IonAvatar, IonSkeletonText,
  IonButton, IonLabel, IonIcon,
  IonFab, IonFabButton,
  IonButtons, IonBackButton   // ✅ IMPORTADOS
} from '@ionic/angular/standalone';

import { RefresherCustomEvent } from '@ionic/angular';
import { Auth, authState } from '@angular/fire/auth';
import { Subject, of, take } from 'rxjs';
import { switchMap, takeUntil } from 'rxjs/operators';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { add, qrCodeOutline } from 'ionicons/icons';

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
  IonButtons, IonBackButton   // 🔥 NECESARIOS PARA EVITAR EL ERROR
  ],
  templateUrl: './listar-mascotas.component.html',
  styleUrls: ['./listar-mascotas.component.scss'],
  providers: [DatePipe],
})
export class ListarMascotasComponent implements OnInit, OnDestroy {

  private auth = inject(Auth);
  private fs = inject(FirestoreService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  loading = signal(true);
  mascotas = signal<Mascota[]>([]);
  usuarioUid = signal<string | null>(null);

  constructor() {
    // Registrar iconos
    addIcons({ add, qrCodeOutline });

    // Obtener usuario + mascotas
    authState(this.auth)
      .pipe(
        switchMap(user => {
          const uid = user?.uid ?? null;
          this.usuarioUid.set(uid);
          return uid ? this.fs.getUserPets(uid) : of<Mascota[]>([]);
        }),
        takeUntil(this.destroy$)
      )
      .subscribe(pets => {
        this.mascotas.set(pets ?? []);
        this.loading.set(false);
      });
  }

  ngOnInit() {}

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, m: Mascota) => m.id;

  // Refrescar listado
  doRefresh(ev: Event): void {
    const refresher = ev as RefresherCustomEvent;
    const uid = this.usuarioUid();

    if (!uid) {
      refresher.target.complete();
      return;
    }

    this.loading.set(true);

    this.fs.getUserPets(uid).pipe(take(1)).subscribe({
      next: pets => {
        this.mascotas.set(pets ?? []);
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
