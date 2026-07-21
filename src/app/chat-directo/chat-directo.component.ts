import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ToastController,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { pawOutline, sendOutline } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

type EstadoTraspaso = 'ninguno' | 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';

@Component({
  selector: 'app-chat-directo',
  standalone: true,
  templateUrl: './chat-directo.component.html',
  styleUrls: ['./chat-directo.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonFooter, IonIcon, IonInput, IonButton, IonSpinner,
  ],
})
export class ChatDirectoComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly alertCtrl = inject(AlertController);
  private readonly toastCtrl = inject(ToastController);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLElement>;
  private debeHacerScroll = false;

  chatId = '';
  miUid = '';
  /** Nombre de la otra persona y de la mascota, para el título. */
  titulo = signal('Chat');
  mensajes = signal<Models.ChatDirecto.Mensaje[]>([]);
  cargando = signal(true);
  texto = '';
  enviando = false;

  chat = signal<Models.ChatDirecto.Chat | null>(null);
  esRefugio = signal(false);
  estadoTraspaso = signal<EstadoTraspaso>('ninguno');
  enviandoTraspaso = false;

  constructor() {
    addIcons({ sendOutline, pawOutline });
  }

  ngOnInit(): void {
    this.chatId = this.route.snapshot.paramMap.get('chatId')!;
    this.miUid = this.auth.getCurrentUser()?.uid ?? '';
    if (!this.chatId) return;

    this.fs.getDocument(`${Models.ChatDirecto.PathChats}/${this.chatId}`).then(chatDoc => {
      if (!chatDoc) return;
      const chat = chatDoc as Models.ChatDirecto.Chat;
      this.chat.set(chat);
      const otro = chat.refugioUid === this.miUid ? chat.postulanteNombre : chat.refugioNombre;
      this.titulo.set(`${otro} · ${chat.mascotaNombre}`);

      const soyRefugio = chat.refugioUid === this.miUid;
      this.esRefugio.set(soyRefugio);
      if (soyRefugio && chat.mascotaId) this.cargarEstadoTraspaso(chat);
    });

    this.fs.getMensajesChatDirecto(this.chatId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mensajes => {
        this.mensajes.set(mensajes ?? []);
        this.cargando.set(false);
        this.debeHacerScroll = true;
      });
  }

  private cargarEstadoTraspaso(chat: Models.ChatDirecto.Chat): void {
    this.fs.getTransferenciasEnviadas(chat.refugioUid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(transferencias => {
        const ultima = transferencias.find(t =>
          t.mascotaId === chat.mascotaId && t.paraEmail === chat.postulanteEmail.trim().toLowerCase()
        );
        this.estadoTraspaso.set(ultima?.estado ?? 'ninguno');
      });
  }

  ngAfterViewChecked(): void {
    if (this.debeHacerScroll) {
      this.debeHacerScroll = false;
      this.scrollToBottom();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  trackById = (_: number, m: { id?: string }) => m.id;

  /** createdAt es un serverTimestamp: en el propio mensaje recién enviado
   *  puede llegar null un instante hasta que el servidor lo resuelve. */
  horaDe(m: Models.ChatDirecto.Mensaje): string {
    const ts = m.createdAt?.toDate?.();
    if (!ts) return 'enviando…';
    return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async enviar(): Promise<void> {
    const texto = this.texto.trim();
    if (!texto || this.enviando) return;
    this.enviando = true;
    try {
      await this.fs.enviarMensajeChatDirecto(this.chatId, texto);
      this.texto = '';
    } catch {
      // El input conserva el texto para que se pueda reintentar.
    } finally {
      this.enviando = false;
    }
  }

  async enviarTraspaso(): Promise<void> {
    const chat = this.chat();
    if (!chat?.mascotaId || this.enviandoTraspaso) return;

    const alert = await this.alertCtrl.create({
      header: 'Enviar traspaso de la mascota',
      message: `${chat.postulanteNombre} va a recibir una solicitud para pasar a ser dueño/a de ${chat.mascotaNombre}. Recién se transfiere cuando la acepte desde sus notificaciones.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar traspaso',
          handler: async () => {
            this.enviandoTraspaso = true;
            try {
              await this.fs.crearTransferencia(
                'adopcion', chat.mascotaId!, chat.mascotaNombre,
                chat.refugioUid, chat.refugioNombre, chat.postulanteEmail
              );
              await this.fs.enviarMensajeChatDirecto(
                this.chatId,
                `📬 Envié la solicitud de traspaso de ${chat.mascotaNombre}. Avisame cuando la aceptes desde tus notificaciones.`
              );
              this.estadoTraspaso.set('pendiente');
              await this.mostrarToast('Traspaso enviado.', 'success');
            } catch (err: any) {
              await this.mostrarToast(err?.message || 'No se pudo enviar el traspaso.', 'danger');
            } finally {
              this.enviandoTraspaso = false;
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async mostrarToast(message: string, color: 'success' | 'danger'): Promise<void> {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color });
    await toast.present();
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
