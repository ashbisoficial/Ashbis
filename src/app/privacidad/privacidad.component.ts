import { Component } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-privacidad',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton],
  templateUrl: './privacidad.component.html',
  styleUrls: ['./privacidad.component.scss']
})
export class PrivacidadComponent {
  // ion-content scrollea dentro de su shadow DOM: el salto de ancla nativo
  // del navegador (href="#id") no llega a ese contenedor, así que hay que
  // moverlo a mano con scrollIntoView.
  ir(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
