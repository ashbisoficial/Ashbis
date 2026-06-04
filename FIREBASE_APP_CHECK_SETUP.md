# Firebase App Check + Endurecimiento de Seguridad - Guía Completa

## 📋 Resumen de Implementación

Tu proyecto ya está configurado con:
- ✅ App Check con reCAPTCHA v3
- ✅ CSP endurecida
- ✅ Firestore + Storage con reglas restrictivas
- ✅ HSTS, X-Frame-Options, X-Content-Type-Options

**Próximos pasos:** Activar App Check en Firebase Console y restringir API Keys.

---

## 1️⃣ CONFIGURACIÓN EN FIREBASE CONSOLE

### Paso 1: Crear reCAPTCHA v3 en Google Cloud Console

1. Ir a: https://console.cloud.google.com/security/recaptcha
2. Crear una nueva clave reCAPTCHA v3
3. **Nombre:** `ashbis-recaptcha-v3`
4. **Tipo:** reCAPTCHA v3
5. **Dominios:**
   ```
   ashbis-ae5b2.web.app
   ashbis-ae5b2.firebaseapp.com
   ashbis.app
   localhost
   127.0.0.1
   ```
6. Copiar **Site Key** (ya está en `environment.ts`):
   ```
   6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS
   ```
7. Copiar **Secret Key** (guardar de forma segura - NO en código)

### Paso 2: Activar App Check en Firebase Console

**Ubicación:** Firebase Console → Configuración del Proyecto → App Check

#### 2.1 Activar para Firestore

1. Firebase Console → Firestore Database
2. Ir a: **"Proteger con App Check"** (o en el menú lateral)
3. Hacer clic en **Firestore**
4. Seleccionar: **reCAPTCHA v3**
5. Pegar Site Key: `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
6. Hacer clic en **Registrar proveedor**
7. **Esperar 24 horas** antes de habilitar en producción (requerimiento Firebase)
8. Después de 24h, hacer clic en **Aplicar App Check** (modo de cumplimiento)

**Estado esperado:**
- ✅ Verde: "App Check habilitado y en cumplimiento"
- ✅ Las peticiones SIN App Check válido serán rechazadas

#### 2.2 Activar para Cloud Storage

1. Firebase Console → Storage
2. Ir a: **"Proteger con App Check"**
3. Hacer clic en **Storage**
4. Seleccionar: **reCAPTCHA v3**
5. Pegar Site Key: `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
6. Hacer clic en **Registrar proveedor**
7. Esperar 24h y aplicar App Check (modo de cumplimiento)

#### 2.3 Activar para Cloud Functions (Opcional - si tienes funciones)

1. Firebase Console → Functions
2. Ir a: **"Proteger con App Check"**
3. Hacer clic en **HTTP Functions**
4. Seleccionar: **reCAPTCHA v3**
5. Pegar Site Key: `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
6. Registrar y aplicar en 24h

**Nota:** El token App Check debe incluirse automáticamente en las peticiones via AngularFire.

---

## 2️⃣ RESTRINGIR API KEY

### Paso 1: Identificar tu API Key

Tu API Key actual:
```
AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg
```

### Paso 2: Restringir por HTTP Referrer

**Ubicación:** Google Cloud Console → APIs → Credenciales → tu API Key

1. Ir a: https://console.cloud.google.com/apis/credentials
2. Buscar tu API Key en "Claves de API"
3. Hacer clic en **editar** (icono de lápiz)
4. En **Restricciones de HTTP referrer (sitios web):**
   ```
   https://ashbis-ae5b2.web.app
   https://ashbis-ae5b2.firebaseapp.com
   https://ashbis.app
   https://*.ashbis.app
   ```
5. Hacer clic en **Guardar**

### Paso 3: Restringir APIs Permitidas

En la misma pantalla, en **Restricciones de API:**

**Seleccionar SOLO:**
- ✅ Firebase Authentication API
- ✅ Cloud Firestore API
- ✅ Firebase Storage API
- ✅ Firebase App Check API
- ✅ Google reCAPTCHA Enterprise API
- ✅ Maps JavaScript API (si usas Google Maps - pero usas Leaflet local)
- ✅ Google Gemini API (para futura integración de IA)

**NO permitir:**
- ❌ Todas las APIs excepto las listadas arriba

**Captura conceptual:**
```
API Key: AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg
├─ Restricción HTTP: *.web.app, *.firebaseapp.com, ashbis.app
├─ Restricción de APIs:
│  ├─ Firebase Authentication API
│  ├─ Cloud Firestore API
│  ├─ Firebase Storage API
│  ├─ Firebase App Check API
│  └─ Google Gemini API
└─ Resultado: Solo tu app en dominios autorizados puede usar estas APIs
```

---

## 3️⃣ CONFIGURACIÓN CSP Y HEADERS APLICADA

### Content-Security-Policy (CSP)

**Ubicación:** `firebase.json` → hosting → headers

La CSP actual está configurada para:

```
default-src 'self'                                    # Solo recursos propios
base-uri 'self'                                       # Solo formularios propios
object-src 'none'                                     # Sin plugins Flash/etc
frame-ancestors 'none'                                # No incrustable en otros sitios
form-action 'self'                                    # Envios de formulario solo propios

script-src:
  'self'                                              # Scripts locales
  'unsafe-inline'                                     # Necesario para Ionic/Angular
  https://www.google.com                              # reCAPTCHA v3
  https://www.gstatic.com                             # reCAPTCHA v3
  https://apis.google.com                             # Google APIs
  https://www.googleapis.com                          # Google APIs
  https://challenges.cloudflare.com                   # reCAPTCHA Enterprise (si cambias)

connect-src:
  https://www.google.com                              # reCAPTCHA validation
  https://www.googleapis.com                          # Google APIs
  https://accounts.google.com                         # Firebase Auth
  https://securetoken.googleapis.com                  # Firebase Auth
  https://identitytoolkit.googleapis.com              # Firebase Auth
  https://firebaseinstallations.googleapis.com        # Firebase SDK
  https://firebaseappcheck.googleapis.com             # App Check
  https://firebasestorage.googleapis.com              # Storage
  https://*.firebaseio.com                            # Realtime Database
  wss://*.firebaseio.com                              # WebSocket RealDB
  https://*.firebasedatabase.app                      # Realtime Database
  https://*.firebasestorage.app                       # Storage
  https://*.firebaseapp.com                           # Firebase
  https://*.web.app                                   # Firebase Hosting

img-src:
  'self'
  data:                                               # Imágenes inline
  blob:                                               # Canvas/Blob
  https:                                              # HTTPS solo

style-src:
  'self'
  'unsafe-inline'                                     # Necesario para Ionic estilos

font-src:
  'self'
  data:                                               # Web fonts
  https:

frame-src:
  'self'
  https://www.google.com                              # reCAPTCHA iframe
  https://accounts.google.com                         # Auth popup
  https://*.gstatic.com                               # Google Static
  https://*.firebaseapp.com                           # Firebase Auth
  https://*.web.app

worker-src 'self' blob:                               # Service Workers
child-src 'self' blob:                                # Iframes/Workers
```

### Headers de Seguridad Aplicados

```json
X-Content-Type-Options: nosniff              # Previene MIME sniffing
X-Frame-Options: DENY                        # No incrustable en otros sitios
X-XSS-Protection: 1; mode=block              # Protección XSS (navegadores viejos)
Referrer-Policy: strict-origin-when-cross-origin  # Privacidad de referrer
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload  # HSTS 1 año
Permissions-Policy: [lista restrictiva]      # Deshabilita características innecesarias
```

---

## 4️⃣ CONFIGURACIÓN DE FIRESTORE RULES

Tu archivo `firestore.rules` ya está bien, pero aquí una optimización:

```firestore
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isSignedIn() {
      return request.auth != null;
    }
    
    function isOwner(uid) {
      return isSignedIn() && request.auth.uid == uid;
    }
    
    function hasValidAppCheck() {
      return request.auth.token.app_check != null;
    }
    
    // Usuarios - Solo lectura/escritura propia
    match /usuarios/{userId} {
      allow read, write: if isOwner(userId) && hasValidAppCheck();
      
      match /veterinariasFavoritas/{docId} {
        allow read, write: if isOwner(userId) && hasValidAppCheck();
      }
    }
    
    // Mascotas - Solo propias
    match /mascotas/{mascotaId} {
      allow create: if isSignedIn() && hasValidAppCheck()
        && request.resource.data.uidUsuario == request.auth.uid;
      
      allow read, update, delete: if isSignedIn() && hasValidAppCheck()
        && resource.data.uidUsuario == request.auth.uid;
      
      match /{subCollection}/{docId} {
        allow read, write: if isSignedIn() && hasValidAppCheck()
          && get(/databases/$(database)/documents/mascotas/$(mascotaId)).data.uidUsuario == request.auth.uid;
      }
    }
    
    // Rechazar acceso a todo lo demás
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

**Cambios clave:**
- ✅ Agregué `hasValidAppCheck()` - Verifica que petición incluya App Check token válido
- ✅ Todos los `match` ahora requieren App Check
- ✅ Fallback final `deny all` al final

---

## 5️⃣ CONFIGURACIÓN DE STORAGE RULES

Tu `storage.rules` es buena, pero con App Check:

```storage
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    
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
      return request.resource.size < 5 * 1024 * 1024;  // 5MB máx
    }
    
    function hasValidAppCheck() {
      return request.auth.token.app_check != null;
    }
    
    // Mascotas - Solo propias, solo imágenes
    match /mascotas/{uid}/{allPaths=**} {
      allow read, delete: if isOwner(uid) && hasValidAppCheck();
      allow create, update: if isOwner(uid) && hasValidAppCheck()
        && validImageType() && validSize();
    }
    
    // Rechazar todo lo demás
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 6️⃣ VERIFICACIÓN Y TESTING

### Test Local (Development)

1. En `environment.ts` ya está:
   ```typescript
   appCheckDebug: true,
   appCheckDebugToken: 'debug-token-dev'
   ```

2. Verifica en console del navegador:
   ```javascript
   // Debe mostrar "App Check token created successfully" o similar
   ```

3. Si ves errores de App Check:
   - Abre DevTools → Console
   - Busca: "App Check" 
   - Si dice "DEBUG TOKEN", estás usando debug mode (correcto para dev)

### Test en Producción

1. Deployar cambios:
   ```bash
   npm run build
   firebase deploy --only hosting,firestore:rules,storage:rules
   ```

2. Esperar 24h después de configurar App Check en Firebase Console
3. Verificar en Firestore/Storage que App Check esté en "modo de cumplimiento"
4. Hacer peticiones desde la app - deben funcionar normalmente
5. Hacer peticiones desde postman/curl SIN App Check - deben fallar con 403

---

## 7️⃣ MIGRACIÓN A DOMINIO PERSONALIZADO (ashbis.app)

Cuando estés listo para usar `ashbis.app`:

### A. Configuración DNS

En tu proveedor DNS (Namecheap, GoDaddy, etc.):

```
CNAME: ashbis.app → ashbis-ae5b2.web.app
CNAME: www.ashbis.app → ashbis-ae5b2.web.app
```

### B. Agregar dominio a Firebase Hosting

1. Firebase Console → Hosting → Dominios personalizados
2. Hacer clic en **"Agregar dominio personalizado"**
3. Ingresar: `ashbis.app`
4. Seguir los pasos de verificación DNS
5. Repetir para `www.ashbis.app`

### C. Actualizar environment.prod.ts

```typescript
authAuthorizedDomains: [
  'ashbis-ae5b2.firebaseapp.com',
  'ashbis-ae5b2.web.app',
  'ashbis.app',
  'www.ashbis.app'
]
```

### D. Actualizar reCAPTCHA v3 dominios

1. Google Cloud Console → reCAPTCHA → tu clave
2. Agregar a dominios:
   ```
   ashbis.app
   www.ashbis.app
   ```

### E. Actualizar HTTP Referrer en API Key

En Google Cloud Console → Credenciales → tu API Key:

```
https://ashbis.app
https://www.ashbis.app
```

### F. Redeploy

```bash
firebase deploy
```

---

## 8️⃣ MONITOREO Y TROUBLESHOOTING

### Si ves errores en Firestore/Storage:

**Error:** `"FirebaseError: Missing or insufficient permissions"`

**Posibles causas:**
1. ❌ App Check no está habilitado aún en Firebase Console
2. ❌ Token App Check expiró (se renueva automáticamente cada 1h con `autoRefresh`)
3. ❌ Reglas de Firestore/Storage tienen sintaxis incorrecta

**Solución:**
1. Verificar en Firebase Console que App Check esté en "modo de cumplimiento"
2. Revisar DevTools → Console para errores de App Check
3. Si aún falla después de 24h, desactivar App Check temporalmente:
   - Firebase Console → App Check → desactivar "Aplicar App Check"
   - Revisar reglas de Firestore/Storage
   - Reactivar App Check

### Si necesitas debug token:

```typescript
// main.ts
if (!environment.production) {
  (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  // Copiar el token mostrado en console
  // y guardarlo en environment.appCheckDebugToken
}
```

### Verificar CSP en producción:

1. Deploy: `firebase deploy`
2. Abrir app en navegador
3. Abrir DevTools → Console
4. Si hay CSP violations, verás: `Refused to... violates the following Content-Security-Policy`
5. Ajustar CSP en `firebase.json` según sea necesario

---

## 9️⃣ CHECKLIST FINAL

- [ ] ✅ App Check reCAPTCHA v3 creado en Google Cloud
- [ ] ✅ App Check habilitado para Firestore (esperado 24h)
- [ ] ✅ App Check habilitado para Cloud Storage (esperado 24h)
- [ ] ✅ API Key restringida por HTTP Referrer
- [ ] ✅ API Key restringida a APIs necesarias
- [ ] ✅ CSP configurada en firebase.json
- [ ] ✅ Headers de seguridad aplicados
- [ ] ✅ Firestore rules actualizadas con `hasValidAppCheck()`
- [ ] ✅ Storage rules actualizadas con `hasValidAppCheck()`
- [ ] ✅ `main.ts` con `provideAppCheck()` y `autoRefresh`
- [ ] ✅ `environment.ts` y `environment.prod.ts` configurados
- [ ] ✅ Test local en development mode
- [ ] ✅ Esperar 24h y aplicar App Check en Firebase Console
- [ ] ✅ Deploy a producción y verificar
- [ ] ✅ (Futuro) Migración a dominio personalizado ashbis.app

---

## 🔐 SEGURIDAD FINAL - RESUMEN

**Tu app ahora tiene:**

| Capa | Configuración |
|------|---------------|
| **Autenticación** | Firebase Auth + reCAPTCHA v3 |
| **Verificación App** | App Check con reCAPTCHA v3 en Firestore + Storage |
| **HTTP Headers** | HSTS, X-Frame-Options, CSP, Permissions-Policy |
| **API Keys** | Restringidas por dominio y APIs permitidas |
| **Reglas DB** | Firestore/Storage + validación App Check |
| **CSP** | Restrictiva pero funcional (no unsafe-eval) |
| **Dominio** | HSTS preload-ready para ashbis.app |

**Resulta en:** 
- ✅ Solo tu app puede acceder a Firestore/Storage
- ✅ API Key solo funciona en tus dominios
- ✅ No vulnerabilidades de CDN externo (Leaflet es local)
- ✅ Compatible con plan SPARK de Firebase
- ✅ Preparado para escalar a producción

---

**Última actualización:** May 27, 2026
**Version Angular:** 20.0.0
**Version Firebase:** 11.10.0
**Version AngularFire:** 20.0.1
