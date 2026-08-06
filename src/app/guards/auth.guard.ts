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

/** Cuenta admin de Ashbis, identificada por email — mismo criterio que
 *  esAdminAshbis() en firestore.rules y ADMIN_EMAILS en functions/src/index.ts.
 *  Si cambia acá, hay que cambiar los otros dos. */
const ADMIN_EMAILS = ['ashbis.oficial@gmail.com'];

/**
 * Guard para la pantalla admin de revisión de veterinarios: redirige a
 * /tabs/home si la cuenta autenticada no es la de Ashbis. Es solo una
 * comodidad de UI (evita mostrar una pantalla que igual va a fallar) — el
 * permiso real lo hacen valer las reglas de Firestore y la Cloud Function,
 * no este guard.
 */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    map((user) => {
      if (user?.email && ADMIN_EMAILS.includes(user.email)) return true;
      return router.createUrlTree(['/tabs/home']);
    })
  );
};

/**
 * Guard para listar-mascotas/crear-mascotas: una cuenta veterinario no
 * tiene mascotas propias, accede a pacientes ajenos por PIN (pestaña
 * Veterinario) — si entra por URL directa a alguna de estas dos rutas
 * (la pestaña "Mis Mascotas" ya está oculta para ese rol en tabs.component),
 * la redirige a su panel en vez de dejarla actuar como dueña de mascotas.
 * Igual que adminGuard: es solo comodidad de UI, no reemplaza que las
 * Firestore Rules validen el acceso real.
 */
export const noVeterinarioGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  const firestore = inject(Firestore);
  const router = inject(Router);

  return authState(auth).pipe(
    take(1),
    switchMap((user) => {
      if (!user) return of(router.createUrlTree(['/login']));
      return getDoc(doc(firestore, `usuarios/${user.uid}`)).then((snap) =>
        snap.data()?.['rol'] === 'veterinario'
          ? router.createUrlTree(['/tabs/veterinario-panel'])
          : true
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