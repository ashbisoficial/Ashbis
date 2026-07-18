import { Component } from '@angular/core';
import { IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton } from '@ionic/angular/standalone';

@Component({
  selector: 'app-terminos',
  standalone: true,
  imports: [IonContent, IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton],
  templateUrl: './terminos.component.html',
  styleUrls: ['./terminos.component.scss']
})
export class TerminosComponent {
  // ion-content scrollea dentro de su shadow DOM: el salto de ancla nativo
  // del navegador (href="#id") no llega a ese contenedor, así que hay que
  // moverlo a mano con scrollIntoView.
  ir(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
