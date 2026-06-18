import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Auth, authState } from '@angular/fire/auth';
import { map, take } from 'rxjs/operators';

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