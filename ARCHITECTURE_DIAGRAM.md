# 🏗️ ARQUITECTURA DE SEGURIDAD - Diagrama y Flujo

## 1. FLUJO DE VERIFICACIÓN - Estructura General

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  USUARIO EN NAVEGADOR (https://ashbis-ae5b2.web.app)             │
│                                                                   │
│  1. Abre app Angular                                             │
│  2. Bootstrap carga main.ts                                      │
│  3. initializeAppCheck() se ejecuta                              │
│  4. reCAPTCHA v3 se carga (background)                           │
│  5. Se obtiene App Check token                                   │
│                                                                   │
└─────────────┬───────────────────────────────────────────────────┘
              │
              │ CSP: Solo scripts de 'self', google.com, gstatic.com
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  PETICIÓN A FIRESTORE (Firebase SDK automático)                  │
│                                                                   │
│  POST https://firestore.googleapis.com/v1/projects/.../docs      │
│  Headers:                                                         │
│    - Authorization: Bearer [AUTH_TOKEN]                          │
│    - X-Goog-Firebase-Request: [APP_CHECK_TOKEN] ← NUEVO          │
│                                                                   │
└─────────────┬───────────────────────────────────────────────────┘
              │
              │ CSP: connect-src https://firebaseappcheck.googleapis.com
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  FIREBASE APP CHECK VALIDATION (Google Servers)                  │
│                                                                   │
│  ¿El token es válido?                                            │
│  ├─ ✅ Fue emitido por reCAPTCHA v3                              │
│  ├─ ✅ No expiró                                                 │
│  ├─ ✅ Dominio = ashbis-ae5b2.web.app                            │
│  └─ ✅ API Key = restringida a este dominio                      │
│                                                                   │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ├─ SI ✅ → Continuar a Firestore
              │
              └─ SI ❌ → ERROR 403 Forbidden
                         (rechazar petición)
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  FIRESTORE RULES ENGINE                                           │
│                                                                   │
│  ¿El usuario puede acceder?                                      │
│  ├─ ✅ ¿Está autenticado? (Firebase Auth)                        │
│  ├─ ✅ ¿Tiene App Check válido?                                  │
│  └─ ✅ ¿El documento es suyo? (reglas Firestore)                 │
│                                                                   │
│  if (isSignedIn && hasValidAppCheck && isOwner) → ALLOW          │
│  else → DENY                                                     │
│                                                                   │
└─────────────┬───────────────────────────────────────────────────┘
              │
              ├─ ✅ Retornar documentos
              │
              └─ ❌ Error "Missing or insufficient permissions"
              │
              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  CLIENTE (App Angular) recibe respuesta                          │
│                                                                   │
│  ✅ Datos mostrados en UI                                        │
│  ❌ Error manejado por catchError                                │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. CAPAS DE SEGURIDAD

```
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 1: Transport Security                                        │
│ ─────────────────────────────────────────────────────────────── │
│ • HTTPS obligatorio (CSP: https:)                                │
│ • HSTS 1 año (previene downgrade a HTTP)                         │
│ • Certificados válidos (Firebase Hosting)                        │
└─────────────────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 2: Client Verification (App Check)                          │
│ ─────────────────────────────────────────────────────────────── │
│ • reCAPTCHA v3: Verifica usuario humano                          │
│ • Token App Check: Prueba que es tu app (no acceso externo)      │
│ • Validación automática en cada petición                         │
│ • Auto-refresh cada ~1 hora (isTokenAutoRefreshEnabled)          │
└─────────────────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 3: Authentication                                           │
│ ─────────────────────────────────────────────────────────────── │
│ • Firebase Auth: UID del usuario                                 │
│ • Token JWT: Validado por Firebase                               │
│ • Persistencia local: browserLocalPersistence                    │
└─────────────────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 4: Authorization (Rules)                                    │
│ ─────────────────────────────────────────────────────────────── │
│ Firestore:                                                       │
│   allow read, write:                                             │
│     if isSignedIn() && hasValidAppCheck() && isOwner(uid)        │
│                                                                  │
│ Storage:                                                         │
│   allow create, update:                                          │
│     if isOwner(uid) && hasValidAppCheck() && validImageType()    │
└─────────────────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 5: API Key Restrictions                                     │
│ ─────────────────────────────────────────────────────────────── │
│ • HTTP Referrer: ashbis-ae5b2.web.app (solo)                    │
│ • APIs permitidas: Solo Firestore, Storage, Auth, App Check     │
│ • Sin acceso desde Postman o curl (referrer no coincide)         │
└─────────────────────────────────────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────┐
│ CAPA 6: Content-Security-Policy (CSP)                            │
│ ─────────────────────────────────────────────────────────────── │
│ • Bloquea inyección de scripts (XSS)                             │
│ • Bloquea inyección de estilos (CSS)                             │
│ • Bloquea iframes de sitios maliciosos                           │
│ • Bloquea formularios a servidores externos                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. FLUJO DETALLADO: Caso de Uso "Ver Mis Mascotas"

```
USUARIO ABRE APP
      │
      ▼
┌──────────────────────────────────────┐
│ 1. Bootstrap Angular                 │
│    main.ts se ejecuta                │
└──────────────────────────────────────┘
      │
      ├─ registerLocaleData(localeEsCl)
      ├─ provideFirebaseApp()
      ├─ provideAuth()
      ├─ provideFirestore()
      ├─ provideStorage()
      └─ provideAppCheck() ← AQUÍ
           │
           ├─ initializeAppCheck(getApp(), {
           │    provider: new ReCaptchaV3Provider(...),
           │    isTokenAutoRefreshEnabled: true
           │  })
           │
           ▼
           Obtener App Check Token de reCAPTCHA
           • Google verifica: ¿Es humano? ¿Es tu app?
           • Emite token válido por ~1 hora
      │
      ▼
┌──────────────────────────────────────┐
│ 2. Usuario hace login                │
│    Firebase Auth                     │
└──────────────────────────────────────┘
      │
      ├─ email + password
      ├─ Firebase Auth verifica credenciales
      ├─ Emite JWT (access token)
      └─ Guardado en localStorage (browserLocalPersistence)
      │
      ▼
┌──────────────────────────────────────┐
│ 3. Usuario navega a "/mascotas"      │
│    Componente carga datos             │
└──────────────────────────────────────┘
      │
      ├─ Component llama a Service
      ├─ Service hace query Firestore:
      │
      │  this.firestore.collection('mascotas')
      │    .where('uidUsuario', '==', this.auth.currentUser.uid)
      │    .get()
      │
      ▼
┌──────────────────────────────────────┐
│ 4. Firebase SDK prepara petición     │
│    (Automático - NO escribes código) │
└──────────────────────────────────────┘
      │
      ├─ Auth Token: JWT del usuario logueado
      ├─ App Check Token: Obtenido en step 1 (renovado si necesario)
      ├─ URL: firestore.googleapis.com/...
      └─ Headers: Authorization + X-Goog-Firebase-Request
      │
      ▼
┌──────────────────────────────────────┐
│ 5. CAPA 1: CSP                       │
│    Navegador verifica                │
└──────────────────────────────────────┘
      │
      ├─ ¿Destino HTTPS? ✅ (CSP: connect-src ...https:)
      ├─ ¿Dominio permitido? ✅ (firebaseappcheck.googleapis.com)
      └─ → Permitir conexión
      │
      ▼
┌──────────────────────────────────────┐
│ 6. CAPA 2: Validación App Check      │
│    Google servers verifican token    │
└──────────────────────────────────────┘
      │
      ├─ ¿Token fue emitido por nosotros? ✅
      ├─ ¿Token no expiró? ✅ (válido ~1h)
      ├─ ¿Dominio coincide? ✅ (ashbis-ae5b2.web.app)
      ├─ ¿API Key válida? ✅ (restringida por referrer)
      └─ → Continuar a Firestore
      │
      ▼
┌──────────────────────────────────────┐
│ 7. CAPA 3: Validación Auth           │
│    Firebase Auth verifica JWT        │
└──────────────────────────────────────┘
      │
      ├─ ¿JWT válido y no expiró? ✅
      ├─ ¿UID en JWT = request.auth.uid? ✅
      └─ → Continuar a Rules
      │
      ▼
┌──────────────────────────────────────┐
│ 8. CAPA 4: Firestore Rules Engine    │
│    Verificar acceso a documentos     │
└──────────────────────────────────────┘
      │
      ├─ Evaluar regla para /mascotas/{mascotaId}:
      │
      │  allow read: if 
      │    isSignedIn() &&              // ✅ SÍ, tiene JWT
      │    hasValidAppCheck() &&        // ✅ SÍ, tiene token App Check
      │    resource.data.uidUsuario == request.auth.uid  // ✅ SÍ, es suyo
      │
      └─ → Retornar documentos del usuario
      │
      ▼
┌──────────────────────────────────────┐
│ 9. Respuesta Firebase                │
│    Retorna mascotas del usuario      │
└──────────────────────────────────────┘
      │
      ├─ JSON con documentos
      └─ Status 200 OK
      │
      ▼
┌──────────────────────────────────────┐
│ 10. Angular procesa respuesta        │
│     Muestra datos en UI               │
└──────────────────────────────────────┘
      │
      └─ Lista de mascotas visible en pantalla

=== USUARIO VE SUS MASCOTAS EN LA APP ===
```

---

## 4. ESCENARIOS DE ATAQUE BLOQUEADOS

### ❌ ATAQUE 1: Acceso directo via cURL
```
$ curl https://firestore.googleapis.com/v1/projects/ashbis-ae5b2/...
     -H "Authorization: Bearer STOLEN_JWT"

Resultado:
BLOQUEADO en CAPA 2 (App Check)
- No tiene App Check token
- Referrer HTTP ≠ ashbis-ae5b2.web.app
- Rechazado con 403 Forbidden
```

### ❌ ATAQUE 2: Acceso con API Key robada
```
$ curl https://firestore.googleapis.com/v1/projects/ashbis-ae5b2/...
     -H "key: AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg"

Resultado:
BLOQUEADO en CAPA 5 (API Key Restrictions)
- Referrer != ashbis-ae5b2.web.app
- APIs restringidas (Firestore permitido, pero sin Auth/App Check)
- Rechazado con 403 Forbidden
```

### ❌ ATAQUE 3: Acceso a otro usuario
```
// En app, intentar cambiar UID en reglas
mascotas.where('uidUsuario', '==', 'otro_usuario_id')

Resultado:
BLOQUEADO en CAPA 4 (Firestore Rules)
- hasValidAppCheck() ✅
- isSignedIn() ✅
- PERO: resource.data.uidUsuario ('otro_usuario_id') != request.auth.uid (tu_uid)
- Rechazado: "Missing or insufficient permissions"
```

### ❌ ATAQUE 4: XSS (Inyección de scripts)
```html
<!-- Atacante intenta inyectar en app -->
<script src="https://malicioso.com/hack.js"></script>

Resultado:
BLOQUEADO en CAPA 6 (CSP)
- script-src no incluye malicioso.com
- Navegador rechaza: "Refused to load the script..."
- Script nunca ejecuta
```

### ❌ ATAQUE 5: Clickjacking
```html
<!-- Atacante embebería tu app en iframe oculto -->
<iframe src="https://ashbis-ae5b2.web.app"></iframe>

Resultado:
BLOQUEADO en CAPA 6 (CSP: frame-ancestors 'none')
- Navegador rechaza: "Refused to frame..."
- App no se embebe
```

---

## 5. FLUJO DE DATOS CON TODAS LAS CAPAS

```
USUARIO                    NAVEGADOR              FIREBASE              DATABASE
  │                          │                        │                    │
  │ 1. Abre app             │                        │                    │
  ├─────────────────────────>│                        │                    │
  │                          │ 2. Carga index.html   │                    │
  │                          ├─ CSP headers validados │                    │
  │                          ├─ main.ts ejecutado    │                    │
  │                          │                        │                    │
  │                          │ 3. initializeAppCheck()│                    │
  │                          ├─────────────────────────────────────────────>│
  │                          │ reCAPTCHA v3 token     │                    │
  │                          │<──────────────────────────────────────────── │
  │                          │ (guardado en memoria)  │                    │
  │                          │                        │                    │
  │ 4. Login                 │                        │                    │
  ├─────────────────────────>│                        │                    │
  │                          │ Firebase Auth          │                    │
  │                          ├──────────────────────>│                    │
  │                          │ JWT token              │                    │
  │                          │<──────────────────────┤                    │
  │ (JWT en localStorage)    │<─────────────────────>│                    │
  │                          │                        │                    │
  │ 5. Cargar mascotas       │                        │                    │
  ├─────────────────────────>│                        │                    │
  │                          │ GET mascotas           │                    │
  │                          │ Headers:               │                    │
  │                          │ - Auth: JWT ✅         │                    │
  │                          │ - AppCheck: token ✅  │                    │
  │                          ├─────────────────────>│                    │
  │                          │                    Validar:                │
  │                          │                    - App Check ✅          │
  │                          │                    - Auth ✅               │
  │                          │                    - Rules ✅              │
  │                          │                        │ Consultar docs
  │                          │                        ├───────────────────>│
  │                          │                        │                    │
  │                          │ Retornar docs         │ Mascotas del user  │
  │                          │<─────────────────────┤<───────────────────┤
  │ Mascotas en UI           │<─────────────────────┤                    │
  │<────────────────────────┤                        │                    │
  │                          │                        │                    │

RESULTADO: 🔒 Datos seguros del usuario mostrados en UI
```

---

## 6. MATRIZ DE PERMISOS

```
┌────────────┬───────────────┬──────────────┬────────────────┐
│ Quien      │ Tiene Auth    │ Tiene App    │ Result         │
│            │               │ Check        │                │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Tu app     │ ✅ SÍ         │ ✅ SÍ        │ ✅ PERMITIDO    │
│ (usuario   │               │              │                │
│ autenticado│               │              │                │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Tu app     │ ✅ SÍ         │ ❌ NO        │ ❌ DENEGADO     │
│ (sin App   │               │              │ (AppCheck +    │
│ Check)     │               │              │  renovado)     │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Atacante   │ ❌ NO         │ ❌ NO        │ ❌ DENEGADO     │
│ via cURL   │               │              │ (sin JWT)      │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Atacante   │ ✅ SÍ         │ ❌ NO        │ ❌ DENEGADO     │
│ (JWT robo- │               │              │ (sin AppCheck) │
│ do)        │               │              │                │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Otro       │ ✅ SÍ         │ ✅ SÍ        │ ❌ DENEGADO     │
│ usuario    │ (su JWT)      │ (su App      │ (Rules:        │
│ logueado   │               │ Check)       │ uidUsuario !=  │
│            │               │              │ request.uid)   │
├────────────┼───────────────┼──────────────┼────────────────┤
│ Anónimo    │ ❌ NO         │ ❌ NO        │ ❌ DENEGADO     │
│            │               │              │ (isSignedIn)   │
└────────────┴───────────────┴──────────────┴────────────────┘
```

---

## 7. TIMELINE DE VALIDACIONES

```
PETICIÓN FIRESTORE (milisegundos)

0ms    ────────────────────────────────────────────────────────
       │ Cliente emite petición
       │ Headers: [Auth JWT] [App Check Token]
       │
1ms    │ ────────────────────────────────────────────────────
       │ Validación CAPA 1: CSP (navegador)
       │ ✅ HTTPS + dominio permitido
       │
5ms    │ ────────────────────────────────────────────────────
       │ Llega a Google servers
       │
10ms   │ ────────────────────────────────────────────────────
       │ Validación CAPA 2: App Check
       │ ✅ Token válido + no expirado + dominio coincide
       │
15ms   │ ────────────────────────────────────────────────────
       │ Validación CAPA 3: Auth
       │ ✅ JWT válido + no expirado + UID existe
       │
20ms   │ ────────────────────────────────────────────────────
       │ Validación CAPA 4: Rules
       │ ✅ isSignedIn() ✅ hasValidAppCheck() ✅ isOwner()
       │
25ms   │ ────────────────────────────────────────────────────
       │ Acceso a Database + Lectura documentos
       │ SELECT * FROM mascotas WHERE uidUsuario = ?
       │
50ms   │ ────────────────────────────────────────────────────
       │ Retornar respuesta (JSON con mascotas)
       │
55ms   ────────────────────────────────────────────────────
       → Cliente recibe datos ✅

TOTAL: ~55ms desde petición hasta respuesta
TODAS las capas pasadas ✅
```

---

## 8. COMPONENTES DE SEGURIDAD Y RESPONSABILIDADES

```
┌─────────────────────────────────────────────────────────────────┐
│ NAVEGADOR (Cliente)                                              │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Enforza CSP (no carga scripts bloqueados)                      │
│ ✓ Almacena JWT en localStorage (persistencia)                    │
│ ✓ Almacena App Check token en memoria                           │
│ ✓ Valida HTTPS                                                  │
│ ✓ Maneja cookies/tokens                                         │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                     (communicate)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ TU APP ANGULAR (main.ts + Services)                              │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Inicializa Firebase App                                       │
│ ✓ Configura provideAppCheck()                                   │
│ ✓ Maneja login/logout                                           │
│ ✓ Llama a Firestore/Storage via AngularFire                     │
│ ✓ Maneja errores de autorización                                │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                     (peticiones HTTPS)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ FIREBASE SDK (AngularFire)                                       │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Agrega headers (Auth + App Check)                             │
│ ✓ Maneja token refresh automático                               │
│ ✓ Encripta datos en tránsito (HTTPS)                            │
│ ✓ Maneja conexión/reconexión                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                     (peticiones HTTPS)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ GOOGLE SERVERS (Firebase Backend)                                │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Valida App Check token                                        │
│ ✓ Valida Auth JWT                                               │
│ ✓ Ejecuta Firestore Rules Engine                                │
│ ✓ Encripta datos en reposo                                      │
│ ✓ Registra auditoria                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↑
                     (peticiones de datos)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ FIRESTORE DATABASE (Google Cloud)                                │
├─────────────────────────────────────────────────────────────────┤
│ ✓ Almacena documentos encriptados                               │
│ ✓ Backups automáticos                                           │
│ ✓ Replicación (redundancia)                                     │
│ ✓ Retorna SOLO datos autorizados                                │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. COMPARATIVA: ANTES vs DESPUÉS

```
ANTES (Sin App Check):

usuario con API Key  ──────┐
                           │
atacante con API Key ──────┤
                           ├──→ Firebase
usuario anónimo ───────────┤
                           │
bot malicioso ─────────────┘

🚨 PROBLEMA: Cualquiera accede

═════════════════════════════════════════════════════════════

DESPUÉS (Con App Check):

usuario con API Key  ──┐    (no tiene App Check token)
                       ├──→ ❌ BLOQUEADO
                       │
atacante con API Key ──┤    (no tiene App Check token)
                       │
usuario anónimo ───────┤    (no tiene Auth + App Check)
                       │
bot malicioso ─────────┘    (no tiene Auth + App Check)


usuario en tu app ─────────→ ✅ Auth ✅ App Check ✅ → PERMITIDO

═════════════════════════════════════════════════════════════

RESULTADO: SOLO tu app puede acceder
```

---

**Diagrama versión:** 1.0
**Última actualización:** May 27, 2026
**Compatible con:** Angular 20, Firebase 11.10, AngularFire 20.0.1
