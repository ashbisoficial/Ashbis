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
  megaphoneOutline,
  personOutline
} from 'ionicons/icons';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
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
  private auth = inject(AuthenticationService);
  private fs = inject(FirestoreService);
  private push = inject(PushNotificationService);

  esRefugio = false;

  constructor() {
    addIcons({
      homeOutline,
      listOutline,
      addCircleOutline,
      megaphoneOutline,
      personOutline
    });

    const uid = this.auth.getCurrentUser()?.uid;
    if (uid) {
      this.fs.getDocument(`usuarios/${uid}`).then(perfil => {
        this.esRefugio = perfil?.rol === 'refugio';
      });
    }

    // No hace nada en web (isNative=false); en la app nativa pide permiso
    // (si no se pidió antes) y registra el token del dispositivo.
    this.push.init();
  }
}
