import { registerLocaleData } from '@angular/common';
import localeEsCl from '@angular/common/locales/es-CL';

import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { bootstrapApplication } from '@angular/platform-browser';
import { RouteReuseStrategy, provideRouter, withPreloading, PreloadAllModules } from '@angular/router';

import { provideIonicAngular, IonicRouteStrategy } from '@ionic/angular/standalone';

import { provideFirebaseApp, initializeApp, getApp } from '@angular/fire/app';
import {
  provideAuth,
  getAuth
} from '@angular/fire/auth';
// App Check deshabilitado temporalmente para el beta — ver nota en providers más abajo.
// import {
//   provideAppCheck,
//   initializeAppCheck,
//   ReCaptchaV3Provider
// } from '@angular/fire/app-check';

import { provideFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from '@angular/fire/firestore';
import { provideStorage, getStorage } from '@angular/fire/storage';

import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authInterceptor } from './app/interceptors/auth.interceptor';
import { environment } from './environments/environment';

registerLocaleData(localeEsCl);

// ── App Check en modo debug para desarrollo local ───────────────────────────
// En localhost, reCAPTCHA v3 no puede verificar el dominio real, así que
// usamos un "debug token". IMPORTANTE: usamos un token FIJO (no `true`) para
// que funcione en cualquier navegador/perfil/máquina que abras en localhost.
// Si se deja en `true`, Firebase genera un token ALEATORIO distinto por cada
// navegador/perfil, y solo el que hayas registrado en la consola funcionará
// (por eso fallaba el login en otro navegador).
// Este token ya debe estar registrado en:
// Firebase Console > Build > App Check > Apps > (tu app web) > ⋮ > Administrar
// tokens de depuración > Agregar token de depuración.
if (!environment.production) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = '851c0fdb-5c66-4e26-b1f2-c23abd32e8aa';
}

bootstrapApplication(AppComponent, {
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },

    provideIonicAngular(),

    provideRouter(routes, withPreloading(PreloadAllModules)),

    provideHttpClient(withInterceptors([authInterceptor])),

    provideFirebaseApp(() => initializeApp(environment.firebase)),

    provideAuth(() => getAuth()),

    // App Check deshabilitado temporalmente para el beta: reCAPTCHA v3 devolvía
    // 400 (dominio/site key no verificados), lo que hacía fallar el token de
    // App Check y Firestore rechazaba todas las lecturas/escrituras con
    // "Missing or insufficient permissions" aunque el usuario estuviera
    // autenticado. Reactivar antes del lanzamiento público:
    // provideAppCheck(() =>
    //   initializeAppCheck(undefined, {
    //     provider: new ReCaptchaV3Provider(environment.appCheckSiteKey),
    //     isTokenAutoRefreshEnabled: true
    //   })
    // ),

    // Caché local persistente (IndexedDB): sin esto, cada vez que se abre
    // una pantalla la app espera la respuesta de red antes de mostrar algo
    // — con la caché, lo último que se vio se pinta al toque mientras
    // Firestore sincroniza en segundo plano. También ayuda a que la app no
    // se quede "pegada" al volver de segundo plano con mala señal.
    provideFirestore(() => initializeFirestore(getApp(), {
      localCache: persistentLocalCache({ tabManager: persistentSingleTabManager({}) }),
    })),

    provideStorage(() => getStorage())
  ]
}).catch(err => console.error(err));