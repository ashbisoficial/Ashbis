import { Component } from '@angular/core';

@Component({
  selector: 'app-privacidad-contenido',
  standalone: true,
  templateUrl: './privacidad-contenido.component.html',
  styleUrls: ['./privacidad-contenido.component.scss']
})
export class PrivacidadContenidoComponent {
  // ion-content scrollea dentro de su shadow DOM: el salto de ancla nativo
  // del navegador (href="#id") no llega a ese contenedor, así que hay que
  // moverlo a mano con scrollIntoView.
  ir(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
