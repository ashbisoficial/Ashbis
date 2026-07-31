import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { Firestore, doc, getDoc } from '@angular/fire/firestore';
import { map, switchMap, take } from 'rxjs/operators';
import { of } from 'rxjs';

/**
 * Guard principal: redirige a /login si el usuario no está autenticado.
 */
export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (user) return true;
      return router.createUrlTree(['/login']);
    })
  );
};

/**
 * Guard para /tabs (y cualquier otra ruta que asuma que ya existe
 * usuarios/{uid}): quien se registra con email/contraseña siempre pasa por
 * el formulario de registro, que crea el perfil antes de navegar — pero
 * quien entra con Google por primera vez queda autenticado ANTES de elegir
 * tipo de cuenta (ver completar-perfil.component). Si cierra la app justo
 * en ese momento y vuelve más tarde, esta ruta lo manda a terminar ese paso
 * en vez de dejarlo entrar con un perfil a medio crear.
 */
export const perfilCompletoGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return getDoc(doc(firestore, `usuarios/${user.uid}`)).then((snap) =>
        snap.exists() ? true : router.createUrlTree(['/completar-perfil'])
      );
    })
  );
};

/**
 * Guard inverso: redirige a /tabs/home si el usuario YA está autenticado.
 * Úsalo en las rutas de login y registro para evitar que vuelvan atrás.
 */
export const publicGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (!user) return true;
      return router.createUrlTree(['/tabs/home']);
    })
  );
};