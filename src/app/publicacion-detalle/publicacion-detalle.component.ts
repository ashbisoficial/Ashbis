import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonBadge,
  IonSpinner,
} from '@ionic/angular/standalone';
import { Subject, switchMap, takeUntil } from 'rxjs';

import { FirestoreService } from '../firebase/firestore';
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
  ],
})
export class PublicacionDetalleComponent implements OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly firestoreService = inject(FirestoreService);
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

  constructor() {
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
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
