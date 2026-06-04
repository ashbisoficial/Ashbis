import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';
import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';
import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
  provideAuth,
  initializeAuth,
  browserLocalPersistence,
  browserPopupRedirectResolver
} from '@angular/fire/auth';
import { provideFirestore, getFirestore } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';
import { provideAppCheck, initializeAppCheck, ReCaptchaV3Provider } from '@angular/fire/app-check';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { environment } from './environments/environment';

registerLocaleData(localeEsCl);

if (!environment.production && environment.appCheckDebug) {
  (self as Window & typeof globalThis & { FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean })
    .FIREBASE_APPCHECK_DEBUG_TOKEN = environment.appCheckDebugToken || true;
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() =>
      initializeAuth(getApp(), {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver
      })
    ),
    provideFirestore(() => getFirestore()),
    provideStorage(() => getStorage()),
    provideAppCheck(() =>
      initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(
          environment.appCheckSiteKey
        ),
        isTokenAutoRefreshEnabled: true
      })
    )
  ]
}).catch((err) => console.error(err));
