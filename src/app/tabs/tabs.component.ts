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
  personOutline
} from 'ionicons/icons';
import { take } from 'rxjs';
import { RefugioContextService } from '../services/refugio-context.service';
import { PushNotificationService } from '../services/push-notification.service';

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

  /** Refugios a los que tengo acceso (propio y/o los que colaboro). Vacío = no se muestra el tab. */
  private misRefugios: string[] = [];

  constructor() {
    addIcons({
      homeOutline,
      listOutline,
      addCircleOutline,
      pawOutline,
      personOutline
    });

    this.refugioCtx.contexto$()
      .pipe(take(1))
      .subscribe(ctx => { this.misRefugios = ctx.todos; });

    // No hace nada en web (isNative=false); en la app nativa pide permiso
    // (si no se pidió antes) y registra el token del dispositivo.
    this.push.init();
  }

  get mostrarTabRefugio(): boolean {
    return this.misRefugios.length > 0;
  }

  irARefugio(): void {
    this.refugioCtx.irARefugio(this.misRefugios, '/tabs/refugio-panel');
  }
}
