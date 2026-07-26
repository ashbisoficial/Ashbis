import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';


import {
  IonIcon,
  IonTabBar,
  IonTabButton,
  IonTabs,
  IonLabel
} from '@ionic/angular/standalone';


import { addIcons } from 'ionicons';
import {
  homeOutline,
  listOutline,
  addCircleOutline,
  pawOutline,
  personOutline,
  medkitOutline,
  storefrontOutline
} from 'ionicons/icons';
import { take } from 'rxjs';
import { RefugioContextService } from '../services/refugio-context.service';
import { PushNotificationService } from '../services/push-notification.service';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';

@Component({
  selector: 'app-tabs',
  templateUrl: './tabs.component.html',
  styleUrls: ['./tabs.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    IonIcon,
    IonTabBar,
    IonTabButton,
    IonTabs,
    IonLabel
  ]
})
export class TabsComponent {
  private readonly refugioCtx = inject(RefugioContextService);
  private readonly push = inject(PushNotificationService);
  private readonly auth = inject(AuthenticationService);
  private readonly fs = inject(FirestoreService);

  /**
   * href del tab "Refugio": SIEMPRE la ruta estática sin uid, nunca
   * "/tabs/refugio-panel/{uid}". Ionic navega los tab-buttons con
   * `tabsPrefix + '/' + tab` (ignora el href real del botón al hacer
   * click), así que un href dinámico con uid nunca matchea y termina en el
   * fallback de ruta no encontrada. RefugioPanelComponent, al recibir la
   * ruta sin uid, resuelve solo a qué refugio corresponde y redirige.
   */
  hrefRefugio: string | null = null;

  /** Solo cuentas rol 'veterinario' ven este tab (panel propio, sin parámetro). */
  esVeterinario = false;
  /** Solo cuentas rol 'servicio' (peluquería/guardería/funeraria). */
  esServicio = false;

  constructor() {
    addIcons({
      homeOutline,
      listOutline,
      addCircleOutline,
      pawOutline,
      personOutline,
      medkitOutline,
      storefrontOutline
    });

    this.refugioCtx.contexto$()
      .pipe(take(1))
      .subscribe(ctx => {
        this.hrefRefugio = ctx.todos.length ? '/tabs/refugio-panel' : null;
      });

    const uid = this.auth.getCurrentUser()?.uid;
    if (uid) {
      this.fs.getDocument(`usuarios/${uid}`).then(perfil => {
        this.esVeterinario = perfil?.rol === 'veterinario';
        this.esServicio = perfil?.rol === 'servicio';
      });
    }

    // No hace nada en web (isNative=false); en la app nativa pide permiso
    // (si no se pidió antes) y registra el token del dispositivo.
    this.push.init();
  }
}
