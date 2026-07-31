import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { Router, NavigationStart } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { Firestore, disableNetwork, enableNetwork } from '@angular/fire/firestore';
import { PreferenciasService } from './services/preferencias.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent {
  private readonly router = inject(Router);
  private readonly firestore = inject(Firestore);
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

    if (Capacitor.isNativePlatform()) {
      this.reconectarFirestoreAlVolver();
    }
  }

  /** Al volver del segundo plano, los listeners en tiempo real de Firestore
   *  a veces quedan "colgados" (el canal WebChannel se corta con el celular
   *  bloqueado/sin red y no siempre se reconecta solo) — la app se ve lenta
   *  para cargar o pantallas que dependen de esos datos no arrancan.
   *  Forzar un apagado/prendido de la red de Firestore reinicia esos
   *  streams; es el mecanismo que recomienda Firebase para este caso. */
  private reconectarFirestoreAlVolver(): void {
    import('@capacitor/app').then(({ App }) => {
      App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) return;
        disableNetwork(this.firestore)
          .then(() => enableNetwork(this.firestore))
          .catch(() => { /* si falla, los listeners igual reintentan solos */ });
      });
    });
  }
}