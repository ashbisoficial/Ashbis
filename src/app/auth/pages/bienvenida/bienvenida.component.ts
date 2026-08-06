import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonIcon,
  IonImg,
  IonItem,
  IonLabel,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonThumbnail,
  IonToggle,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  cameraOutline, colorPaletteOutline, locationOutline, moonOutline,
  notificationsOutline, shieldCheckmarkOutline, sunnyOutline, textOutline,
} from 'ionicons/icons';
import { PreferenciasService, Tema, TamanoTexto } from 'src/app/services/preferencias.service';
import { PushNotificationService } from 'src/app/services/push-notification.service';

type EstadoPermiso = 'concedido' | 'denegado' | 'no-pedido' | 'no-soportado';

/**
 * Pantalla mostrada una sola vez, justo después de crear la cuenta (desde
 * RegistroComponent o CompletarPerfilComponent) y antes de entrar a
 * /tabs/home: pregunta por las mismas preferencias que ya existen en
 * Configuración (tema, tamaño de letra, notificaciones, cámara y ubicación)
 * para que no queden escondidas hasta que alguien las descubra por su
 * cuenta. Todo es opcional — "Continuar" siempre avanza, se haya tocado
 * algo o no.
 */
@Component({
  selector: 'app-bienvenida',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonLabel,
    IonSegment,
    IonSegmentButton,
    IonToggle,
    IonButton,
    IonIcon,
    IonSpinner,
    IonThumbnail,
    IonImg,
  ],
  templateUrl: './bienvenida.component.html',
  styleUrls: ['./bienvenida.component.scss'],
})
export class BienvenidaComponent implements OnInit {
  private readonly preferencias = inject(PreferenciasService);
  private readonly push = inject(PushNotificationService);
  private readonly router = inject(Router);

  tema: Tema = this.preferencias.tema;
  tamanoTexto: TamanoTexto = this.preferencias.tamanoTexto;

  estadoNotificaciones: EstadoPermiso = 'no-pedido';
  cargandoNotificaciones = false;

  constructor() {
    addIcons({
      cameraOutline, colorPaletteOutline, locationOutline, moonOutline,
      notificationsOutline, shieldCheckmarkOutline, sunnyOutline, textOutline,
    });
  }

  async ngOnInit(): Promise<void> {
    this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
  }

  get camaraHabilitada(): boolean {
    return this.preferencias.camaraHabilitada;
  }

  get ubicacionHabilitada(): boolean {
    return this.preferencias.ubicacionHabilitada;
  }

  cambiarTema(tema: string | number | undefined): void {
    if (tema !== 'oscuro' && tema !== 'claro') return;
    this.tema = tema;
    this.preferencias.setTema(tema);
  }

  cambiarTamanoTexto(tamano: string | number | undefined): void {
    if (tamano !== 'pequeno' && tamano !== 'normal' && tamano !== 'grande' && tamano !== 'muy-grande') return;
    this.tamanoTexto = tamano;
    this.preferencias.setTamanoTexto(tamano);
  }

  async alternarNotificaciones(activar: boolean): Promise<void> {
    this.cargandoNotificaciones = true;
    try {
      if (activar) {
        await this.push.activar();
      } else {
        await this.push.olvidarTokenActual();
      }
      this.estadoNotificaciones = await this.push.obtenerEstadoPermiso();
    } finally {
      this.cargandoNotificaciones = false;
    }
  }

  /** Además del interruptor propio de Ashbis, dispara una vez el prompt real
   *  del navegador/SO — a diferencia de Configuración (donde se pide recién
   *  al primer uso), acá tiene sentido pedirlo de entrada. */
  alternarCamara(activar: boolean): void {
    this.preferencias.setCamaraHabilitada(activar);
    if (activar && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(stream => stream.getTracks().forEach(t => t.stop()))
        .catch(() => { /* permiso rechazado: el interruptor de Ashbis queda igual, no se usa la cámara hasta que lo permita desde su dispositivo */ });
    }
  }

  alternarUbicacion(activar: boolean): void {
    this.preferencias.setUbicacionHabilitada(activar);
    if (activar && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(() => {}, () => {});
    }
  }

  continuar(): void {
    this.router.navigate(['/tabs/home'], { replaceUrl: true });
  }
}
