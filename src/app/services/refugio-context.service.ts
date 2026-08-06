import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';
import { Observable, combineLatest, firstValueFrom, from, map, of } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';

export interface ContextoRefugio {
  miUid: string | null;
  /** true si la cuenta propia es de rol 'refugio'. */
  esRefugio: boolean;
  /** uids de refugios ajenos de cuyo equipo formo parte. */
  colaboraCon: string[];
  /** Todos los refugios a los que tengo acceso: el propio (si aplica) primero, luego los que colaboro. */
  todos: string[];
}

/**
 * Centraliza "¿a qué refugio(s) tengo acceso?" para no repetir la misma
 * consulta (perfil propio + getMisRefugios) en tabs.component, home.component
 * y cualquier otro lugar que necesite decidir a dónde llevar al usuario
 * cuando toca "Refugio" o el chat de equipo.
 */
@Injectable({ providedIn: 'root' })
export class RefugioContextService {
  private readonly auth = inject(AuthenticationService);
  private readonly fs = inject(FirestoreService);
  private readonly router = inject(Router);
  private readonly alertCtrl = inject(AlertController);

  contexto$(): Observable<ContextoRefugio> {
    const uid = this.auth.getCurrentUser()?.uid ?? null;
    if (!uid) {
      return of({ miUid: null, esRefugio: false, colaboraCon: [], todos: [] });
    }
    return combineLatest([
      from(this.fs.getDocument(`usuarios/${uid}`)),
      this.fs.getMisRefugios(uid),
    ]).pipe(
      map(([perfil, colaboraCon]) => {
        const esRefugio = perfil?.rol === 'refugio';
        const todos = esRefugio ? [uid, ...colaboraCon] : colaboraCon;
        return { miUid: uid, esRefugio, colaboraCon, todos };
      })
    );
  }

  /** Nombre para mostrar de un refugio puntual (para el selector cuando hay más de uno). */
  nombreRefugio$(refugioUid: string): Observable<string> {
    return from(this.fs.getDocument(`usuarios/${refugioUid}`)).pipe(
      map(perfil => perfil?.nombreRefugio?.trim() || 'Refugio')
    );
  }

  /**
   * Navega a `rutaBase/refugioUid` para el refugio correcto: directo si solo
   * hay uno, o pidiendo cuál con un alert de radio si hay más de uno. No
   * hace nada si `uids` está vacío (el llamador debería haber ocultado el
   * botón en ese caso).
   */
  async irARefugio(uids: string[], rutaBase: string): Promise<void> {
    if (uids.length === 1) {
      await this.router.navigate([rutaBase, uids[0]]);
      return;
    }
    if (uids.length <= 1) return;

    const opciones = await Promise.all(
      uids.map(async (uid, i) => ({
        type: 'radio' as const,
        label: await firstValueFrom(this.nombreRefugio$(uid)),
        value: uid,
        checked: i === 0,
      }))
    );
    const alert = await this.alertCtrl.create({
      header: 'Elige un refugio',
      inputs: opciones,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        { text: 'Ir', handler: (uid: string) => this.router.navigate([rutaBase, uid]) },
      ],
    });
    await alert.present();
  }
}
