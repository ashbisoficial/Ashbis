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

interface FilaChat {
  tipo: 'equipo' | 'directo';
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
  private readonly router = inject(Router);
  private readonly destroy$ = new Subject<void>();

  cargando = true;
  filas: FilaChat[] = [];

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
              ruta: ['/tabs/chat-directo', c.id!],
              titulo: otro,
              subtitulo: `Adopción · ${c.mascotaNombre}`,
              creadoEn: c.createdAt?.toMillis?.() ?? 0,
            };
          })
          .sort((a, b) => b.creadoEn - a.creadoEn);

        this.filas = [...filasEquipo, ...filasDirectas];
        this.cargando = false;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  abrir(fila: FilaChat): void {
    this.router.navigate(fila.ruta);
  }
}
