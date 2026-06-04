# ✅ CHECKLIST OPERATIVO - FIREBASE APP CHECK + SEGURIDAD

## 📌 ESTADO ACTUAL (May 27, 2026)

### ✅ Completado en el código:
- [x] `main.ts` - App Check reCAPTCHA v3 configurado
- [x] `environment.ts` - Variables de configuración (dev)
- [x] `environment.prod.ts` - Variables de configuración (prod + dominios futuros)
- [x] `firebase.json` - CSP endurecida + headers de seguridad
- [x] `firestore.rules` - Reglas + validación App Check
- [x] `storage.rules` - Reglas + validación App Check

**Status:** 60% completado. Falta configuración en Firebase Console.

---

## 🚀 PLAN DE ACCIÓN - ORDEN CORRECTO

### FASE 1: Hoy (Preparación - Sin impacto en usuarios)

#### Paso 1.1: Crear/Verificar reCAPTCHA v3 en Google Cloud
**Tiempo:** 5 minutos
**Impacto:** Ninguno

1. Ir a: https://console.cloud.google.com/security/recaptcha
2. Verificar que existe la clave `ashbis-recaptcha-v3` (tipo: reCAPTCHA v3)
3. **Dominios configurados:**
   ```
   ashbis-ae5b2.web.app
   ashbis-ae5b2.firebaseapp.com
   ashbis.app
   localhost
   127.0.0.1
   ```
4. **Site Key:** `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS` ✓ (ya está en environment.ts)
5. Guardar **Secret Key** en lugar seguro (needed para backend, no en código)

**Checklist:**
- [ ] reCAPTCHA v3 existe
- [ ] Site Key = `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
- [ ] Dominios incluyen ashbis-ae5b2.web.app y ashbis-ae5b2.firebaseapp.com
- [ ] Secret Key guardada en place seguro

---

#### Paso 1.2: Restringir API Key
**Tiempo:** 10 minutos
**Impacto:** Ninguno (usuarios actuales no ven cambio)

1. Ir a: https://console.cloud.google.com/apis/credentials
2. Buscar en "Claves de API": `AIzaSyAhVl-d7fikWwNB4gNPLV6ZcO6mg-CSoEg`
3. Hacer clic en **editar** (icono de lápiz)

**Opción 1: Restricciones HTTP Referrer**
4. En **Restricciones HTTP referrer (sitios web):**
   - Hacer clic en el campo
   - Agregar:
     ```
     https://ashbis-ae5b2.web.app
     https://ashbis-ae5b2.firebaseapp.com
     https://ashbis.app
     https://*.ashbis.app
     ```

**Opción 2: Restricciones de API**
5. En **Restricciones de API:**
   - Seleccionar: **Restrict key** (no "Unrestricted")
   - Seleccionar SOLO:
     - Firebase Authentication API
     - Cloud Firestore API
     - Firebase Storage API
     - Firebase App Check API
     - Google Gemini API (futuro)
   - **NO** permitir otras APIs

6. Hacer clic en **Guardar**

**Checklist:**
- [ ] API Key restringida por HTTP referrer
- [ ] API Key restringida a APIs necesarias
- [ ] Cambios guardados

---

#### Paso 1.3: Deploy de código actual
**Tiempo:** 5 minutos
**Impacto:** Ninguno (código de App Check se ejecuta pero en debug mode)

```bash
# En terminal, desde raíz del proyecto
npm run build
firebase deploy --only hosting,firestore:rules,storage:rules
```

**Checklist:**
- [ ] Build exitoso
- [ ] Deploy completado
- [ ] No hay errores en console

---

### FASE 2: Día +1 a Día +1 (Activación - Con impacto progresivo)

#### Paso 2.1: Activar App Check para Firestore
**Tiempo:** 5 minutos
**Impacto:** ⚠️ IMPORTANTE - Después de 24h, SOLO app con App Check válido puede acceder

1. Ir a: https://console.firebase.google.com/project/ashbis-ae5b2/firestore
2. En el menú izquierdo, ir a: **App Check** (o search "App Check")
3. Hacer clic en **Firestore Database**
4. Si no está registrado:
   - Hacer clic en **Register provider**
   - Tipo: **reCAPTCHA v3**
   - Site Key: `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
   - Hacer clic en **Register**
5. Esperar a que aparezca en la lista con estado "Registered"
6. **ESPERAR 24 HORAS** (requerimiento de Firebase)
7. Después de 24h, cambiar a: **Enforce**
8. Confirmar: "Firestore Database - Enforcement enabled"

**Checklist:**
- [ ] App Check registrado para Firestore
- [ ] Estado: "Registered" (en progreso)
- [ ] Esperar 24h
- [ ] Después de 24h, cambiar a "Enforce"
- [ ] Verificar: usuarios pueden acceder a Firestore

---

#### Paso 2.2: Activar App Check para Cloud Storage
**Tiempo:** 5 minutos
**Impacto:** ⚠️ IMPORTANTE - Después de 24h, SOLO app con App Check válido puede subir/descargar

1. Ir a: https://console.firebase.google.com/project/ashbis-ae5b2/storage
2. Ir a: **App Check** (o search "App Check")
3. Hacer clic en **Cloud Storage**
4. Si no está registrado:
   - Hacer clic en **Register provider**
   - Tipo: **reCAPTCHA v3**
   - Site Key: `6LdcheUsAAAAAFPlmx2tqObzif4QvGLHr6deQhSS`
   - Hacer clic en **Register**
5. Esperar 24 horas
6. Después de 24h, cambiar a: **Enforce**
7. Confirmar: "Cloud Storage - Enforcement enabled"

**Checklist:**
- [ ] App Check registrado para Storage
- [ ] Estado: "Registered" (en progreso)
- [ ] Esperar 24h
- [ ] Después de 24h, cambiar a "Enforce"
- [ ] Verificar: usuarios pueden subir/descargar imágenes

---

#### Paso 2.3: Verificar en App
**Tiempo:** Continuo
**Impacto:** Observar, no actuar

1. Abrir app en navegador (development o producción)
2. Abrir DevTools → Console
3. Buscar mensajes de "App Check":
   - ✅ OK: Sin errores
   - ✅ OK: Token visible en red (Firestore/Storage requests)
   - ❌ ERROR: "Missing or insufficient permissions" → Revisar reglas

4. Si ves errores:
   - Revisar `firestore.rules` y `storage.rules` (ya están actualizadas)
   - Revisar que `hasValidAppCheck()` esté presente
   - Esperar 24h si App Check no está en "Enforce" aún

**Checklist:**
- [ ] App funciona sin errores CSP
- [ ] Console sin errores App Check
- [ ] Firestore lee/escribe OK
- [ ] Storage sube/descarga OK

---

### FASE 3: Día +2+ (Monitoreo)

#### Paso 3.1: Monitoreo continuo
**Frecuencia:** Diaria primera semana, luego semanal

1. Firebase Console → Firestore → Uso/analítica
   - Revisar que lecturas/escrituras funcionan
   - Si hay spike de errores → Revisar console

2. Firebase Console → Storage → Uso/analítica
   - Revisar que descargas/subidas funcionan

3. App console (DevTools)
   - Abrir app en navegador
   - Verificar que no hay CSP errors

4. Si aparecen errores:
   - Documento: [FIREBASE_APP_CHECK_SETUP.md#8️⃣-MONITOREO-Y-TROUBLESHOOTING](FIREBASE_APP_CHECK_SETUP.md#8️⃣-monitoreo-y-troubleshooting)

**Checklist:**
- [ ] Firestore funciona normalmente
- [ ] Storage funciona normalmente
- [ ] Sin errores de seguridad

---

## ⏰ TIMELINE RECOMENDADO

| Día | Acción | Estado | Duración |
|-----|--------|--------|----------|
| HOY | 1.1 Crear reCAPTCHA | 🟢 Inmediato | 5min |
| HOY | 1.2 Restringir API Key | 🟢 Inmediato | 10min |
| HOY | 1.3 Deploy código | 🟢 Inmediato | 5min |
| +1 | 2.1 Registrar Firestore en App Check | 🟡 Esperar 24h | 5min + 1440min |
| +1 | 2.2 Registrar Storage en App Check | 🟡 Esperar 24h | 5min + 1440min |
| +2 | 2.1 Enforc Firestore | 🟢 Activar | 2min |
| +2 | 2.2 Enforce Storage | 🟢 Activar | 2min |
| +2+ | 3.1 Monitoreo | 🟢 Continuo | 5min/día |

**Total tiempo de trabajo:** ~30 minutos durante 2 días

---

## 🔄 ROLLBACK (Si algo falla)

Si después de activar App Check empiezan a fallar peticiones:

### Opción 1: Desactivar temporalmente (5 minutos)

1. Firebase Console → App Check → Firestore/Storage
2. Cambiar de **Enforce** a **Debug**
3. Esperar 5 minutos
4. Las peticiones volverán a funcionar
5. Revisar logs/errores
6. Luego volver a Enforce

### Opción 2: Verificar Reglas (10 minutos)

1. Ver console del navegador para errores específicos
2. Comparar con `firestore.rules` / `storage.rules` en repo
3. Si hay cambios, actualizar Firebase Console:
   - Firebase Console → Firestore → Rules
   - Firebase Console → Storage → Rules
   - Copiar desde los archivos .rules
   - Publicar

### Opción 3: Verificar CSP (10 minutos)

Si ves error `Refused to load...` en console:
1. Copiar el error
2. Comparar con CSP en `firebase.json`
3. Si hay conflicto, actualizar CSP
4. Redeploy: `firebase deploy --only hosting`

---

## 📊 SEÑALES DE ÉXITO

### ✅ Cuando todo funciona:

```
✓ App abre sin errores
✓ Puedo ver mis mascotas (Firestore lee)
✓ Puedo crear mascota (Firestore escribe)
✓ Puedo subir foto (Storage escribe)
✓ Puedo descargar foto (Storage lee)
✓ Console sin CSP errors
✓ Console sin App Check errors
✓ Firebase Console muestra Firestore/Storage "Enforcement enabled"
```

### ❌ Señales de problemas:

```
✗ "Missing or insufficient permissions" → Revisar hasValidAppCheck() en reglas
✗ CSP error en console → Revisar firebase.json headers
✗ App Check error en console → Revisar hasValidAppCheck() en reglas
✗ "PERMISSION_DENIED" → App Check no está habilitado o token expiró
```

---

## 🛠️ COMANDOS RÁPIDOS

```bash
# Ver logs de hosting en vivo
firebase hosting:log

# Deploy solo hosting
firebase deploy --only hosting

# Deploy solo rules
firebase deploy --only firestore:rules,storage:rules

# Emulador local para testing
firebase emulators:start

# Ver estado de deployments
firebase hosting:channel:list

# Revertir a versión anterior
firebase hosting:channel:deploy [CHANNEL_ID]
```

---

## 📞 SOPORTE RÁPIDO

### Si App Check no funciona:

1. **Verificar que reCAPTCHA v3 está registrado:**
   ```bash
   # En app console (DevTools)
   firebase.appCheck().getToken(true)
     .then(r => console.log('Token:', r.token))
     .catch(e => console.error('Error:', e))
   ```

2. **Verificar que App Check está en "Enforce":**
   - Firebase Console → App Check → Firestore/Storage
   - Estado debe ser: "Enforcement enabled"

3. **Verificar que reglas tienen `hasValidAppCheck()`:**
   - Firestore rules debe tener en cada `match`:
     ```firestore
     && hasValidAppCheck()
     ```
   - Storage rules debe tener similar

4. **Si después de 24h aún falla:**
   - Cambiar a "Debug" temporalmente
   - Revisar console del navegador
   - Contactar a Firebase Support

---

## 🔐 SEGURIDAD FINAL RESULTADO

Después de completar estos pasos:

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Acceso a Firestore** | Cualquiera con API Key | Solo app con App Check |
| **Acceso a Storage** | Cualquiera con API Key | Solo app con App Check |
| **API Key** | Sin restricciones | Solo ashbis-ae5b2.web.app, etc |
| **CSP** | Básica | Endurecida + headers |
| **reCAPTCHA** | No verificado | v3 en cada petición |
| **Resultado** | Vulnerable | 🔒 Segura |

---

**Creado:** May 27, 2026
**Última actualización:** May 27, 2026
**Status:** Listo para ejecutar
