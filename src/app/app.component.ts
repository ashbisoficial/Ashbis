import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router, NavigationStart } from '@angular/router';
import { PreferenciasService } from './services/preferencias.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly router = inject(Router);
  // Solo se inyecta para que el constructor de PreferenciasService corra ya
  // (aplica tema/tamaño de texto guardados) apenas arranca la app.
  private readonly preferencias = inject(PreferenciasService);

  constructor() {
    // Ionic oculta la página saliente con aria-hidden="true" durante la
    // transición de rutas. Si un botón (u otro elemento) dentro de esa
    // página todavía tiene el foco, el navegador emite el warning
    // "Blocked aria-hidden on an element because its descendant retained
    // focus". Quitamos el foco apenas comienza la navegación para evitarlo.
    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        const activo = document.activeElement;
        if (activo instanceof HTMLElement) {
          activo.blur();
        }
      }
    });
  }
}