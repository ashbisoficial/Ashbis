import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronForwardOutline, pawOutline, peopleOutline } from 'ionicons/icons';
import { Subject, combineLatest, of } from 'rxjs';
import { map, switchMap, takeUntil } from 'rxjs/operators';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { RefugioContextService } from '../services/refugio-context.service';
import { ChatUnreadService } from '../services/chat-unread.service';

interface FilaChat {
  tipo: 'equipo' | 'directo';
  /** chatId (directo) o refugioUid (equipo) — clave para el puntito de no leído. */
  id: string;
  ruta: string[];
  titulo: string;
  subtitulo: string;
  creadoEn: number;
}

@Component({
  selector: 'app-mis-chats',
  standalone: true,
  templateUrl: './mis-chats.component.html',
  styleUrls: ['./mis-chats.component.scss'],
  imports: [
    CommonModule,
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton,
    IonContent, IonIcon, IonSpinner,
  ],
})
export class MisChatsComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthenticationService);
  private readonly fs = inject(FirestoreService);
  private readonly refugioCtx = inject(RefugioContextService);
  private readonly chatUnread = inject(ChatUnreadService);
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  cargando = true;
  filas: FilaChat[] = [];
  /** Qué filas tienen mensajes sin leer, por "tipo:id" — para el puntito rojo de cada chat. */
  noLeidoPorFila: Record<string, boolean> = {};

  constructor() {
    addIcons({ chevronForwardOutline, pawOutline, peopleOutline });
  }

  ngOnInit(): void {
    const miUid = this.auth.getCurrentUser()?.uid ?? '';
    if (!miUid) { this.cargando = false; return; }

    const equipos$ = this.refugioCtx.contexto$().pipe(
      switchMap(ctx => ctx.todos.length
        ? combineLatest(ctx.todos.map(uid =>
            this.refugioCtx.nombreRefugio$(uid).pipe(map(nombre => ({ uid, nombre })))
          ))
        : of([])
      )
    );

    combineLatest([equipos$, this.fs.getMisChatsDirectos(miUid)])
      .pipe(takeUntil(this.destroy$))
      .subscribe(([equipos, chats]) => {
        const filasEquipo: FilaChat[] = equipos.map(e => ({
          tipo: 'equipo' as const,
          id: e.uid,
          ruta: ['/tabs/refugio-chat', e.uid],
          titulo: e.nombre,
          subtitulo: 'Chat de equipo',
          creadoEn: 0,
        }));

        const filasDirectas: FilaChat[] = chats
          .map(c => {
            const otro = c.refugioUid === miUid ? c.postulanteNombre : c.refugioNombre;
            return {
              tipo: 'directo' as const,
              id: c.id!,
              ruta: ['/tabs/chat-directo', c.id!],
              titulo: otro,
              subtitulo: `Adopción · ${c.mascotaNombre}`,
              creadoEn: c.createdAt?.toMillis?.() ?? 0,
            };
          })
          .sort((a, b) => b.creadoEn - a.creadoEn);

        this.filas = [...filasEquipo, ...filasDirectas];
        this.cargando = false;
        this.cargarNoLeidos(this.filas);
      });
  }

  claveFila(f: FilaChat): string {
    return `${f.tipo}:${f.id}`;
  }

  /** Puntito rojo por fila: se suscribe una vez por chat a si tiene mensajes
   *  sin leer (mismo cálculo que el círculo del ícono de chat en el Home,
   *  pero acá puntual por conversación). */
  private cargarNoLeidos(filas: FilaChat[]): void {
    for (const f of filas) {
      const clave = this.claveFila(f);
      if (clave in this.noLeidoPorFila) continue;
      const noLeido$ = f.tipo === 'directo'
        ? this.chatUnread.tieneNoLeidoDirecto$(f.id)
        : this.chatUnread.tieneNoLeidoEquipo$(f.id);
      noLeido$.pipe(takeUntil(this.destroy$))
        .subscribe(noLeido => this.noLeidoPorFila[clave] = noLeido);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  abrir(fila: FilaChat): void {
    this.router.navigate(fila.ruta);
  }
}
