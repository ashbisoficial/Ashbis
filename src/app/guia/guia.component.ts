import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  pawOutline, personAddOutline, cameraOutline, qrCodeOutline,
  warningOutline, heartOutline, chatbubblesOutline, notificationsOutline,
  settingsOutline, shieldCheckmarkOutline, peopleOutline, medkitOutline,
  swapHorizontalOutline, homeOutline, listOutline, addCircleOutline,
  personOutline, checkmarkCircleOutline,
} from 'ionicons/icons';

@Component({
  selector: 'app-guia',
  standalone: true,
  templateUrl: './guia.component.html',
  styleUrls: ['./guia.component.scss'],
  imports: [CommonModule, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon],
})
export class GuiaComponent {
  readonly secciones = [
    { id: 'cuenta', titulo: 'Tu cuenta' },
    { id: 'mascotas', titulo: 'Mascotas' },
    { id: 'carnet', titulo: 'Carnet y QR' },
    { id: 'perdida', titulo: 'Mascota perdida' },
    { id: 'refugios', titulo: 'Adopciones' },
    { id: 'hogar-temporal', titulo: 'Hogar temporal' },
    { id: 'panel-refugio', titulo: 'Panel de refugio' },
    { id: 'chat', titulo: 'Asistente IA' },
    { id: 'notificaciones', titulo: 'Notificaciones' },
    { id: 'configuracion', titulo: 'Configuración' },
    { id: 'privacidad', titulo: 'Privacidad' },
    { id: 'ayuda', titulo: 'Ayuda' },
  ];

  constructor() {
    addIcons({
      pawOutline, personAddOutline, cameraOutline, qrCodeOutline,
      warningOutline, heartOutline, chatbubblesOutline, notificationsOutline,
      settingsOutline, shieldCheckmarkOutline, peopleOutline, medkitOutline,
      swapHorizontalOutline, homeOutline, listOutline, addCircleOutline,
      personOutline, checkmarkCircleOutline,
    });
  }

  irA(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
