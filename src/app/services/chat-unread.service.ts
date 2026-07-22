import { inject, Injectable } from '@angular/core';
import { Observable, combineLatest, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { RefugioContextService } from './refugio-context.service';

interface MensajeConAutor {
  autorUid: string;
  createdAt?: { toMillis?: () => number };
}

interface Lectura {
  leidoHasta?: { toMillis?: () => number };
}

/**
 * ¿Tengo algún mensaje sin leer, en cualquiera de mis chats (directos de
 * adopción/hogar temporal, o de equipo del refugio)? Para el círculo rojo
 * del ícono de chat en el Home. "Sin leer" = el último mensaje del chat es
 * de otra persona y llegó después de mi última visita (chatsDirectos/{id}/
 * lecturas/{miUid} o usuarios/{refugioUid}/chatEquipoLecturas/{miUid}).
 */
@Injectable({ providedIn: 'root' })
export class ChatUnreadService {
  private readonly auth = inject(AuthenticationService);
  private readonly fs = inject(FirestoreService);
  private readonly refugioCtx = inject(RefugioContextService);

  tengoNoLeidos$(): Observable<boolean> {
    const miUid = this.auth.getCurrentUser()?.uid;
    if (!miUid) return of(false);

    const directos$ = this.fs.getMisChatsDirectos(miUid).pipe(
      switchMap(chats => chats.length
        ? combineLatest(chats.map(c => this.tieneNoLeido(
            this.fs.getUltimoMensajeChatDirecto(c.id!),
            this.fs.getLecturaChatDirecto(c.id!, miUid),
            miUid,
          )))
        : of([] as boolean[])
      ),
      map(flags => flags.some(Boolean)),
    );

    const equipos$ = this.refugioCtx.contexto$().pipe(
      switchMap(ctx => ctx.todos.length
        ? combineLatest(ctx.todos.map(refugioUid => this.tieneNoLeido(
            this.fs.getUltimoMensajeChatEquipo(refugioUid),
            this.fs.getLecturaChatEquipo(refugioUid, miUid),
            miUid,
          )))
        : of([] as boolean[])
      ),
      map(flags => flags.some(Boolean)),
    );

    return combineLatest([directos$, equipos$]).pipe(
      map(([hayDirectos, hayEquipo]) => hayDirectos || hayEquipo)
    );
  }

  private tieneNoLeido(
    ultimo$: Observable<MensajeConAutor | undefined>,
    lectura$: Observable<Lectura | undefined>,
    miUid: string,
  ): Observable<boolean> {
    return combineLatest([ultimo$, lectura$]).pipe(
      map(([ultimo, lectura]) => {
        if (!ultimo || ultimo.autorUid === miUid) return false;
        const tsUltimo = ultimo.createdAt?.toMillis?.();
        if (!tsUltimo) return false; // recién enviado, todavía sin resolver en el server
        const tsLeido = lectura?.leidoHasta?.toMillis?.() ?? 0;
        return tsUltimo > tsLeido;
      })
    );
  }
}
