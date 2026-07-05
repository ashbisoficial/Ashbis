import { Component, inject, signal, OnDestroy } from '@angular/core';
import { NgIf, NgFor, TitleCasePipe } from '@angular/common';
import {
  IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
  IonContent, IonGrid, IonRow, IonCol,
  IonItem, IonLabel, IonButton, IonIcon, IonAvatar, IonList, IonSkeletonText
} from '@ionic/angular/standalone';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { FirestoreService, Mascota } from '../firebase/firestore';
import { VeterinariaFavorita } from 'src/app/firebase/firestore';
import { AuthenticationService } from 'src/app/firebase/authentication';

@Component({
  selector: 'app-mascota-perfil',
  standalone: true,
  imports: [
    NgIf, NgFor,
    IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle,
    IonContent, IonGrid, IonRow, IonCol,
    IonItem, IonLabel, IonButton, IonAvatar, IonList, IonSkeletonText
  ],
  templateUrl: './perfil-mascota.component.html',
  styleUrls: ['./perfil-mascota.component.scss']
})
export class MascotaPerfilComponent implements OnDestroy {
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private fs = inject(FirestoreService);
  private destroy$ = new Subject<void>();

  veterinariasFavoritas: VeterinariaFavorita[] = [];
  private auth = inject(AuthenticationService);

  mascota = signal<Mascota | null>(null);
  loading = signal(true);

  constructor() {
    // 1) intenta tomar desde router state (rápido)
    const st = this.router.getCurrentNavigation()?.extras?.state as { mascota?: Mascota } | undefined;
    if (st?.mascota) {
      this.mascota.set(st.mascota);
      this.loading.set(false);
    }

    // 2) lee por :id (fuente de verdad) — es un stream vivo de Firestore, hay
    // que cortarlo al salir de la pantalla o queda escuchando para siempre.
    const id = this.route.snapshot.paramMap.get('id')!;
    this.fs.getPetById(id)
      .pipe(takeUntil(this.destroy$))
      .subscribe((doc) => {
        if (doc) this.mascota.set(doc);
        this.loading.set(false);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get avatar(): string {
    return this.mascota()?.fotoUrl || 'assets/img/logo_ashbis.jpeg';
  }

  // Acciones (placeholders)
editarPerfil() {
  const id = this.mascota()?.id;
  if (id) {
    this.router.navigate(['/tabs/mascota-editar', id, 'editar']);
  }
}
  verHistorial() { 
    const id = this.mascota()?.id;
    if (id) {
      // La ruta correcta al dashboard de tu equipo
      this.router.navigate(['/tabs/mascota-detalle', id]);
    }
  }
  verQR() { this.router.navigate(['/tabs/mascota-qr',]) }
}
