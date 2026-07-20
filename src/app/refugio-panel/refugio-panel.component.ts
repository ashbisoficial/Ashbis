import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
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
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline, cashOutline, medkitOutline, pawOutline,
  peopleOutline, trashOutline,
} from 'ionicons/icons';
import { combineLatest, Subject, takeUntil } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
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
  ],
})
export class RefugioPanelComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fs = inject(FirestoreService);
  private readonly security = inject(SecurityService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  refugioUid = '';
  nombreRefugio = signal('Refugio');
  cargando = signal(true);

  mascotas = signal<Mascota[]>([]);
  veterinarias = signal<VeterinariaFavorita[]>([]);
  miembros = signal<Models.Equipo.MiembroEquipo[]>([]);

  constructor() {
    addIcons({ addOutline, cashOutline, medkitOutline, pawOutline, peopleOutline, trashOutline });
  }

  ngOnInit(): void {
    this.refugioUid = this.route.snapshot.paramMap.get('refugioUid')!;
    if (!this.refugioUid) return;

    this.fs.getDocument(`usuarios/${this.refugioUid}`).then(perfil => {
      this.nombreRefugio.set(perfil?.nombreRefugio?.trim() || 'Refugio');
    });

    combineLatest([
      this.fs.getUserPetsPropios(this.refugioUid),
      this.fs.getVeterinariasFavoritasByUsuario(this.refugioUid),
      this.fs.getMiembrosEquipo(this.refugioUid),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([mascotas, vets, miembros]) => {
        this.mascotas.set(mascotas ?? []);
        this.veterinarias.set(vets ?? []);
        this.miembros.set(miembros ?? []);
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

  async agregarVeterinaria(): Promise<void> {
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
    if (!v.id) return;
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
