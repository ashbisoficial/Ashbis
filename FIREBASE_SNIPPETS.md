# Firebase App Check - Snippets Listos para Copiar

## 1. environment.ts (Configuración Actual - CORRECTA)

```typescript
// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg",
    authDomain: "ashbis-ae5b2.firebaseapp.com",
    projectId: "ashbis-ae5b2",
    storageBucket: "ashbis-ae5b2.firebasestorage.app",
    messagingSenderId: "691736988474",
    appId: "1:691736988474:web:8fb6e043aa8e0b0c779e03",
    measurementId: "G-8P1SNJ4TL3"
  },
  aiProxyUrl: "/api/ai-proxy",
  appCheckSiteKey: "6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS",
  appCheckDebug: true,
  appCheckDebugToken: 'debug-token-dev',
  authAuthorizedDomains: ['localhost', '127.0.0.1']
};
```

## 2. environment.prod.ts (Configuración Actual - CORRECTA)

```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: "AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg",
    authDomain: "ashbis-ae5b2.firebaseapp.com",
    projectId: "ashbis-ae5b2",
    storageBucket: "ashbis-ae5b2.firebasestorage.app",
    messagingSenderId: "691736988474",
    appId: "1:691736988474:web:8fb6e043aa8e0b0c779e03",
    measurementId: "G-8P1SNJ4TL3"
  },
  aiProxyUrl: "/api/ai-proxy",
  appCheckSiteKey: "6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS",
  appCheckDebug: false,
  appCheckDebugToken: '',
  authAuthorizedDomains: [
    'ashbis-ae5b2.firebaseapp.com',
    'ashbis-ae5b2.web.app',
    'ashbis.app',
    '*.ashbis.app'
  ]
};
```

## 3. main.ts (Bootstrap - Angular Standalone)

```typescript
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

// App Check Debug Token para desarrollo
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
    
    // Firebase Core
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    
    // Firebase Authentication
    provideAuth(() =>
      initializeAuth(getApp(), {
        persistence: browserLocalPersistence,
        popupRedirectResolver: browserPopupRedirectResolver
      })
    ),
    
    // Firebase Firestore
    provideFirestore(() => getFirestore()),
    
    // Firebase Storage
    provideStorage(() => getStorage()),
    
    // Firebase App Check con reCAPTCHA v3
    provideAppCheck(() =>
      initializeAppCheck(getApp(), {
        provider: new ReCaptchaV3Provider(
          environment.appCheckSiteKey
        ),
        isTokenAutoRefreshEnabled: true  // Auto-renovar tokens cada ~1h
      })
    )
  ]
}).catch((err) => console.error(err));
```

## 4. firebase.json - Headers Endurecidos

**Sección completa a reemplazar:**

```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "hosting": {
    "public": "www",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "headers": [
      {
        "source": "**",
        "headers": [
          {
            "key": "X-Content-Type-Options",
            "value": "nosniff"
          },
          {
            "key": "X-Frame-Options",
            "value": "DENY"
          },
          {
            "key": "X-XSS-Protection",
            "value": "1; mode=block"
          },
          {
            "key": "Referrer-Policy",
            "value": "strict-origin-when-cross-origin"
          },
          {
            "key": "Strict-Transport-Security",
            "value": "max-age=31536000; includeSubDomains; preload"
          },
          {
            "key": "Permissions-Policy",
            "value": "accelerometer=(), ambient-light-sensor=(), autoplay=(), battery=(), camera=(), cross-origin-isolated=(), display-capture=(), document-domain=(), encrypted-media=(), execution-while-not-rendered=(), execution-while-out-of-viewport=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), navigation-override=(), payment=(), picture-in-picture=(), publickey-credentials-get=(), speaker-selection=(), sync-xhr=(), usb=(), screen-wake-lock=(), vr=(), xr-spatial-tracking=()"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://apis.google.com https://www.googleapis.com https://challenges.cloudflare.com; connect-src 'self' https://www.google.com https://www.gstatic.com https://www.googleapis.com https://apis.google.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseappcheck.googleapis.com https://firebasestorage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app https://*.firebasestorage.app https://*.firebaseapp.com https://*.web.app; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; frame-src 'self' https://www.google.com https://accounts.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.web.app; worker-src 'self' blob:; child-src 'self' blob:;"
          }
        ]
      },
      {
        "source": "**/index.html",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "no-cache, no-store, must-revalidate"
          },
          {
            "key": "Content-Security-Policy",
            "value": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://apis.google.com https://www.googleapis.com https://challenges.cloudflare.com; connect-src 'self' https://www.google.com https://www.gstatic.com https://www.googleapis.com https://apis.google.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseappcheck.googleapis.com https://firebasestorage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app https://*.firebasestorage.app https://*.firebaseapp.com https://*.web.app; img-src 'self' data: blob: https:; style-src 'self' 'unsafe-inline'; font-src 'self' data: https:; frame-src 'self' https://www.google.com https://accounts.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.web.app; worker-src 'self' blob:; child-src 'self' blob:;"
          }
        ]
      }
    ],
    "rewrites": [
      {
        "source": "/api/ai-proxy",
        "function": "aiProxy"
      },
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "functions": {
    "source": "functions"
  }
}
```

## 5. firestore.rules - Con App Check

```firestore
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Funciones auxiliares
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    
    function hasValidAppCheck() {
      return request.auth.token.app_check != null;
    }
    
    // Usuarios - Solo lectura/escritura propia + App Check
    match /usuarios/{userId} {
      allow read, write: if isOwner(userId) && hasValidAppCheck();
      
      match /veterinariasFavoritas/{docId} {
        allow read, write: if isOwner(userId) && hasValidAppCheck();
      }
    }
    
    // Mascotas - Solo propias + App Check
    match /mascotas/{mascotaId} {
      allow create: if isSignedIn() && hasValidAppCheck()
        && request.resource.data.uidUsuario == request.auth.uid;
      
      allow read, update, delete: if isSignedIn() && hasValidAppCheck()
        && resource.data.uidUsuario == request.auth.uid;
      
      // Subcoleción de mascotas
      match /{subCollection}/{docId} {
        allow read, write: if isSignedIn() && hasValidAppCheck()
          && get(/databases/$(database)/documents/mascotas/$(mascotaId)).data.uidUsuario == request.auth.uid;
      }
    }
    
    // Rechazar todo acceso no autorizado
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

## 6. storage.rules - Con App Check

```storage
rules_version = '2';

service firebase.storage {
  match /b/{bucket}/o {
    
    // Funciones auxiliares
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    
    function validImageType() {
      return request.resource.contentType.matches('image/(jpeg|jpg|png|webp|gif)');
    }
    
    function validSize() {
      return request.resource.size < 5 * 1024 * 1024;  // 5MB máximo
    }
    
    function hasValidAppCheck() {
      return request.auth.token.app_check != null;
    }
    
    // Mascotas - Solo propias, solo imágenes válidas + App Check
    match /mascotas/{uid}/{allPaths=**} {
      allow read, delete: if isOwner(uid) && hasValidAppCheck();
      allow create, update: if isOwner(uid) && hasValidAppCheck()
        && validImageType() && validSize();
    }
    
    // Rechazar todo acceso no autorizado
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

## 7. Comandos para Deployar

```bash
# 1. Build de producción
npm run build

# 2. Deploy completo (hosting, rules, functions)
firebase deploy

# 3. O deploy selectivo
firebase deploy --only hosting
firebase deploy --only firestore:rules
firebase deploy --only storage:rules

# 4. Verificar estado de deploy
firebase hosting:channel:list

# 5. Ver logs de hosting
firebase hosting:log

# 6. Test local antes de deployar
firebase emulators:start
```

## 8. Test de App Check (Verificación)

**En Browser DevTools → Console:**

```javascript
// Verificar que App Check está inicializado
const appCheckProvider = (window as any).firebase?.app?.().appCheck?.();
console.log('App Check:', appCheckProvider);

// Verificar token
firebase.appCheck().getToken(true).then(result => {
  console.log('App Check Token:', result.token);
  console.log('Token expires in:', result.expireTimeMillis);
}).catch(err => {
  console.error('App Check error:', err);
});
```

## 9. HTTP Referrer Restrictions para API Key

En Google Cloud Console, para tu API Key:
```
https://ashbis-ae5b2.web.app
https://ashbis-ae5b2.firebaseapp.com
https://ashbis.app
https://*.ashbis.app
```

## 10. APIs Permitidas para API Key

Seleccionar SOLO:
- Firebase Authentication API
- Cloud Firestore API
- Firebase Storage API
- Firebase App Check API
- Google Gemini API (futura)

---

**Nota:** Todos estos snippets son solo para referencia. Ya están aplicados en tus archivos.
