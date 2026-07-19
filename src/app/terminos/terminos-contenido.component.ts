import { Component } from '@angular/core';

@Component({
  selector: 'app-terminos-contenido',
  standalone: true,
  templateUrl: './terminos-contenido.component.html',
  styleUrls: ['./terminos-contenido.component.scss']
})
export class TerminosContenidoComponent {
  // ion-content scrollea dentro de su shadow DOM: el salto de ancla nativo
  // del navegador (href="#id") no llega a ese contenedor, así que hay que
  // moverlo a mano con scrollIntoView.
  ir(id: string, event: Event): void {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
