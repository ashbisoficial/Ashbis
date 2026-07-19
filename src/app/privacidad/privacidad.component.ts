import { Component } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton } from '@ionic/angular/standalone';
import { PrivacidadContenidoComponent } from './privacidad-contenido.component';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, PrivacidadContenidoComponent],
  templateUrl: './privacidad.component.html',
  styleUrls: ['./privacidad.component.scss']
})
export class PrivacidadComponent {}
