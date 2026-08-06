import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
  IonChip,
  IonLabel
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline, refreshOutline, pawOutline } from 'ionicons/icons';
import { AiProxyService } from 'src/app/services/ai-proxy.service';

interface Mensaje {
  autor: 'Tu' | 'Ashbis IA';
  texto: string;
  hora: string;
}

@Component({
  selector: 'app-chat-ia',
  templateUrl: './chat-ia.component.html',
  styleUrls: ['./chat-ia.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonButton,
    IonInput,
    IonSpinner,
    IonButtons,
    IonBackButton,
    IonIcon,
    IonChip,
    IonLabel
  ]
})
export class ChatIaComponent implements OnInit {

  @ViewChild('scrollContainer') scrollContainer!: ElementRef;

  private readonly aiProxy = inject(AiProxyService);

  /** Chat con IA desactivado para la beta (el proxy a Gemini sigue fallando
   *  en producción). El botón de entrada en Home ya está oculto; esto es un
   *  segundo cierre por si alguien llega directo a /tabs/chat-ia. Volver a
   *  poner en true reactiva la función sin tocar nada más. */
  readonly habilitado = false;

  // ── Estado de pasos ─────────────────────────────────────────────────────
  pasoActual = 1;
  categoriaSeleccionada = '';
  mascotaSeleccionada = '';
  mensaje = '';
  cargando = false;

  mensajes: Mensaje[] = [];

  readonly categorias = [
    { id: 'salud', label: '🏥 Salud' },
    { id: 'alimentacion', label: '🍖 Alimentación' },
    { id: 'emergencias', label: '🚨 Emergencias' },
    { id: 'comportamiento', label: '🐾 Comportamiento' },
    { id: 'cuidados', label: '✂️ Cuidados generales' },
    { id: 'vacunas', label: '💉 Vacunas y medicina' },
    { id: 'app', label: '❓ Ayuda con la app' },
  ];

  readonly tiposMascota = [
    { id: 'perro', label: '🐶 Perro' },
    { id: 'gato', label: '🐱 Gato' },
    { id: 'conejo', label: '🐰 Conejo' },
    { id: 'ave', label: '🐦 Ave' },
    { id: 'hamster', label: '🐹 Hámster' },
    { id: 'otro', label: '🐾 Otro' },
  ];

  constructor() {
    addIcons({ sendOutline, refreshOutline, pawOutline });
  }

  ngOnInit(): void {
    this.agregarMensaje('Ashbis IA',
      'Hola 👋 Soy Ashbis IA. Puedo ayudarte con salud y cuidados de tu mascota, o resolver dudas sobre cómo usar Ashbis. ¿Sobre qué tema quieres consultar hoy?'
    );
  }

  private obtenerHora(): string {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  private agregarMensaje(autor: 'Tu' | 'Ashbis IA', texto: string): void {
    this.mensajes.push({ autor, texto, hora: this.obtenerHora() });
    setTimeout(() => this.scrollToBottom(), 100);
  }

  private scrollToBottom(): void {
    try {
      const el = this.scrollContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    } catch {}
  }

  seleccionarCategoria(categoria: { id: string; label: string }): void {
    this.categoriaSeleccionada = categoria.id;
    this.agregarMensaje('Tu', categoria.label);
    // "Ayuda con la app" no depende del tipo de mascota: va directo a la
    // pregunta, sin el paso intermedio.
    if (categoria.id === 'app') {
      this.agregarMensaje(
        'Ashbis IA',
        'Cuéntame qué necesitas: cómo usar una función, tipos de cuenta, o si quieres reportar un error. ❓'
      );
      this.pasoActual = 3;
    } else {
      this.agregarMensaje('Ashbis IA', '¿Qué tipo de mascota tienes?');
      this.pasoActual = 2;
    }
  }

  seleccionarMascota(tipo: { id: string; label: string }): void {
    this.mascotaSeleccionada = tipo.id;
    this.agregarMensaje('Tu', tipo.label);
    this.agregarMensaje(
      'Ashbis IA',
      `Perfecto. Escribe tu pregunta sobre ${this.categoriaSeleccionada} de tu ${tipo.id} y te ayudaré. 🐾`
    );
    this.pasoActual = 3;
  }

  async enviarPregunta(): Promise<void> {
    const texto = this.mensaje.trim();
    if (!texto || this.cargando) return;

    this.agregarMensaje('Tu', texto);
    this.mensaje = '';
    this.cargando = true;

    try {
      const resp = await this.aiProxy.sendMessage(
        texto,
        this.categoriaSeleccionada,
        this.mascotaSeleccionada
      );
      this.agregarMensaje('Ashbis IA', resp?.text || 'No obtuve respuesta, intenta nuevamente.');
    } catch (error) {
      console.error(error);
      this.agregarMensaje('Ashbis IA', this.mensajeDeError(error));
    } finally {
      this.cargando = false;
    }
  }

  /** El backend manda mensajes específicos (límite de mensajes, sesión
   *  expirada, etc.) en el cuerpo del error — sin esto, cualquier falla
   *  (incluida la genuina) se veía siempre con el mismo texto genérico. */
  private mensajeDeError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const backendMsg = error.error?.error;
      if (typeof backendMsg === 'string' && backendMsg.trim()) return backendMsg;
      if (error.status === 0) {
        return 'No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.';
      }
    }
    return 'Hubo un error al procesar tu pregunta. Intenta de nuevo.';
  }

  reiniciarChat(): void {
    this.pasoActual = 1;
    this.categoriaSeleccionada = '';
    this.mascotaSeleccionada = '';
    this.mensaje = '';
    this.mensajes = [];
    this.ngOnInit();
  }

  // Permite seguir preguntando sin resetear el flujo
  nuevaPregunta(): void {
    this.mensaje = '';
    // pasoActual se mantiene en 3 para seguir chateando
  }
}