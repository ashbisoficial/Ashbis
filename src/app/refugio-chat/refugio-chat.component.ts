import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, inject, OnDestroy, OnInit, ViewChild, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
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
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline } from 'ionicons/icons';
import { Subject, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { Models } from '../models/models';

@Component({
  selector: 'app-refugio-chat',
  standalone: true,
  templateUrl: './refugio-chat.component.html',
  styleUrls: ['./refugio-chat.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonIcon, IonInput, IonButton, IonSpinner,
  ],
})
export class RefugioChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly route = inject(ActivatedRoute);
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly destroy$ = new Subject<void>();

  @ViewChild('scrollContainer') scrollContainer?: ElementRef<HTMLElement>;
  private debeHacerScroll = false;

  refugioUid = '';
  miUid = '';
  nombreRefugio = signal('Refugio');
  mensajes = signal<Models.ChatEquipo.Mensaje[]>([]);
  cargando = signal(true);
  texto = '';
  enviando = false;

  constructor() {
    addIcons({ sendOutline });
  }

  ngOnInit(): void {
    this.refugioUid = this.route.snapshot.paramMap.get('refugioUid')!;
    this.miUid = this.auth.getCurrentUser()?.uid ?? '';
    if (!this.refugioUid) return;

    this.fs.getDocument(`usuarios/${this.refugioUid}`).then(perfil => {
      this.nombreRefugio.set(perfil?.nombreRefugio?.trim() || 'Refugio');
    });

    this.fs.getMensajesChatEquipo(this.refugioUid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mensajes => {
        this.mensajes.set(mensajes ?? []);
        this.cargando.set(false);
        this.debeHacerScroll = true;
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
  horaDe(m: Models.ChatEquipo.Mensaje): string {
    const ts = m.createdAt?.toDate?.();
    if (!ts) return 'enviando…';
    return ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  async enviar(): Promise<void> {
    const texto = this.texto.trim();
    if (!texto || this.enviando) return;
    this.enviando = true;
    try {
      await this.fs.enviarMensajeChatEquipo(this.refugioUid, texto);
      this.texto = '';
    } catch {
      // El input conserva el texto para que se pueda reintentar.
    } finally {
      this.enviando = false;
    }
  }

  private scrollToBottom(): void {
    const el = this.scrollContainer?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
