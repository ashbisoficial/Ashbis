# 🚀 CHEAT SHEET - Firebase App Check (Referencia Rápida)

## ⚡ HOY - 30 MINUTOS

```bash
# 1. Verificar en Google Cloud Console
https://console.cloud.google.com/security/recaptcha
✅ Buscar: ashbis-recaptcha-v3 (tipo v3)
✅ Site Key: 6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS

# 2. Restringir API Key
https://console.cloud.google.com/apis/credentials
✅ API Key: AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg
✅ Agregar HTTP Referrer: ashbis-ae5b2.web.app
✅ Restringir APIs: Firestore, Storage, Auth, App Check

# 3. Deploy
npm run build
firebase deploy --only hosting,firestore:rules,storage:rules

# 4. Verificar
Abrir: https://ashbis-ae5b2.web.app
DevTools → Console → Sin errores rojos
```

---

## ⏳ MAÑANA (+24h) - 15 MINUTOS

```bash
# 5. Firebase Console → App Check → Firestore
https://console.firebase.google.com/project/ashbis-ae5b2/firestore
App Check → Firestore → Click "Enforce" (cambiar de Debug)

# 6. Firebase Console → App Check → Storage
https://console.firebase.google.com/project/ashbis-ae5b2/storage
App Check → Storage → Click "Enforce" (cambiar de Debug)

# 7. Verificar
Abrir app
Hacer login
Cargar mascotas (Firestore lectura) → ✅
Crear mascota (Firestore escritura) → ✅
Subir foto (Storage escritura) → ✅
```

---

## 📁 ARCHIVOS MODIFICADOS (6)

| Archivo | Cambio |
|---------|--------|
| `main.ts` | App Check + reCAPTCHA v3 |
| `environment.ts` | Variables mejoradas |
| `environment.prod.ts` | Dominios futuros |
| `firebase.json` | CSP + headers |
| `firestore.rules` | hasValidAppCheck() |
| `storage.rules` | hasValidAppCheck() |

---

## 📚 DOCUMENTACIÓN (7 ARCHIVOS)

| Archivo | Cuándo leer |
|---------|------------|
| `QUICK_START.md` | Si tienes prisa |
| `RESUMEN_EJECUTIVO.md` | Para entender qué se hizo |
| `FIREBASE_APP_CHECK_SETUP.md` | Guía completa |
| `CHECKLIST_OPERATIVO.md` | Firebase Console steps |
| `CSP_TECHNICAL_REFERENCE.md` | Si necesitas CSP |
| `FIREBASE_SNIPPETS.md` | Código copiable |
| `ARCHITECTURE_DIAGRAM.md` | Cómo funciona |

---

## 🔐 CAPAS DE SEGURIDAD (6)

```
1. Transport      → HTTPS (CSP + HSTS)
2. App Check      → reCAPTCHA v3 token
3. Authentication → JWT Firebase Auth
4. Authorization  → Firestore/Storage rules
5. API Key        → Restringida por dominio
6. CSP            → Bloquea inyecciones
```

---

## 🛡️ ATRIBUTOS CLAVE

### main.ts
```typescript
provideAppCheck(() =>
  initializeAppCheck(getApp(), {
    provider: new ReCaptchaV3Provider(
      environment.appCheckSiteKey
    ),
    isTokenAutoRefreshEnabled: true  // ← AUTO-RENOVAR
  })
)
```

### environment.ts / environment.prod.ts
```typescript
appCheckSiteKey: "6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS",
appCheckDebug: true/false,  // Dev/Prod
authAuthorizedDomains: [    // Dominios permitidos
  'ashbis-ae5b2.web.app',
  'ashbis.app'  // Futuro
]
```

### firebase.json
```json
"headers": [{
  "key": "Content-Security-Policy",
  "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com; connect-src 'self' https://firebaseappcheck.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app; ..."
}]
```

### firestore.rules / storage.rules
```firestore
function hasValidAppCheck() {
  return request.auth.token.app_check != null;
}

allow read, write: if 
  isSignedIn() && 
  hasValidAppCheck() && 
  isOwner(uid);
```

---

## ✅ CHECKLIST FINAL

```
HOY:
[ ] reCAPTCHA v3 verificado
[ ] API Key restringida
[ ] Deploy completado
[ ] App abre sin errores

MAÑANA:
[ ] Firestore App Check → Enforce
[ ] Storage App Check → Enforce
[ ] App funciona normalmente

DESPUÉS:
[ ] 5 días monitoreando
[ ] Sin errores
[ ] ✅ COMPLETADO
```

---

## 🚨 SI ALGO FALLA

### Error: "Missing or insufficient permissions"
```
1. Verificar: Firebase Console → App Check → Firestore/Storage
2. Estado debe ser: "Enforcement enabled"
3. Esperar 5 minutos
4. Reintentar
```

### Error: CSP en DevTools
```
1. Copiar error completo
2. Identificar dominio bloqueado
3. Agregar a firebase.json → CSP
4. firebase deploy --only hosting
```

### Error: App completamente no funciona
```
1. Firebase Console → App Check
2. Cambiar "Enforce" → "Debug"
3. Esperar 5 minutos
4. Recargar app
5. Debe funcionar
6. Diagnosticar problema
7. Reactivar Enforce
```

---

## 🔗 LINKS RÁPIDOS

```
Google Cloud Console:
https://console.cloud.google.com/security/recaptcha

Google Credentials:
https://console.cloud.google.com/apis/credentials

Firebase Console:
https://console.firebase.google.com/project/ashbis-ae5b2

Firebase App Check:
https://console.firebase.google.com/project/ashbis-ae5b2/settings/appcheck

Firestore Console:
https://console.firebase.google.com/project/ashbis-ae5b2/firestore

Storage Console:
https://console.firebase.google.com/project/ashbis-ae5b2/storage
```

---

## 📊 SEGURIDAD ANTES vs DESPUÉS

### ANTES ❌
```
cualquiera_con_api_key → Firestore ✗ INSEGURO
atacante_externo → Storage ✗ INSEGURO
otro_usuario → Datos privados ✗ INSEGURO
```

### DESPUÉS ✅
```
tu_app_con_appcheck → Firestore ✓ SEGURO
usuario_autenticado → Storage ✓ SEGURO
solo_datos_propios → Firestore/Storage ✓ SEGURO
```

---

## ⏱️ TIMELINE

| Cuando | Qué | Duración |
|--------|-----|----------|
| HOY | Pasos 1-4 | 30 min |
| Noche | Esperar | 24h (automático) |
| MAÑANA | Pasos 5-7 | 15 min |
| Semana | Monitoreo | 5 min/día |
| Total | | ~2.5h en 2 días |

---

## 💡 CONCEPTOS

**App Check:** Verifica que petición viene de tu app (no acceso externo)
**reCAPTCHA v3:** Verifica usuario humano en background
**CSP:** Bloquea inyección de scripts/estilos maliciosos
**Firestore Rules:** Define quién puede leer/escribir documentos
**API Key Restriction:** API Key solo funciona en dominios autorizados
**HSTS:** Obliga HTTPS (no permite HTTP)

---

## 🎯 RESULTADO FINAL

```
Tu app está ahora:
✓ 🔒 Protegida con App Check
✓ 🛡️ CSP endurecida
✓ 🔑 API Key restringida
✓ 📱 Presta para Ionic
✓ 🌐 Compatible con ashbis.app
✓ 📊 Enterprise-grade security
```

---

## 📞 REFERENCIAS

- **CSP error?** → CSP_TECHNICAL_REFERENCE.md
- **App Check error?** → FIREBASE_APP_CHECK_SETUP.md#8
- **No sé qué hacer?** → QUICK_START.md
- **Entender todo?** → ARCHITECTURE_DIAGRAM.md
- **Código exacto?** → FIREBASE_SNIPPETS.md
- **Perdido?** → INDEX.md

---

**Last updated:** May 27, 2026
**Status:** ✅ Production Ready
**Next step:** QUICK_START.md (Paso 1)
