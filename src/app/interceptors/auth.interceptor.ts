import { HttpInterceptorFn, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';
import { environment } from 'src/environments/environment';

/**
 * Interceptor que adjunta el ID token de Firebase en las peticiones
 * al AI proxy y a cualquier endpoint interno que lo requiera.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Solo aplica a rutas internas / AI proxy
  const isInternalApi =
    req.url.startsWith(environment.aiProxyUrl) ||
    req.url.startsWith('/api/');

  if (!isInternalApi) {
    return next(req);
  }

  const auth = inject(Auth);

  return from(
    auth.currentUser
      ? auth.currentUser.getIdToken(/* forceRefresh= */ false)
      : Promise.resolve(null)
  ).pipe(
    switchMap((token) => {
      if (!token) return next(req);

      const cloned = req.clone({
        setHeaders: { Authorization: `Bearer ${token}` },
      });
      return next(cloned);
    })
  );
};