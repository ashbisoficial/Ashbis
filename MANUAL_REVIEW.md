# 🔒 CAMBIOS PARA REVISIÓN MANUAL (No se aplicarán automáticamente)

**Estado:** PREPARADOS - REQUIEREN CONFIRMACIÓN EXPLÍCITA  
**Riesgo:** 🔴 ALTO (Afectan usuarios en VIVO)

---

# CAMBIO MANUAL 1: Firestore Rules

**Archivo:** `firestore.rules`  
**Impacto:** CRÍTICO - Afecta permisos de Firestore EN VIVO  
**Acción requerida:** Revisar, aprobar, desplegar manualmente

---

## 🔴 PROBLEMA ACTUAL

```javascript
// firestore.rules - LÍNEAS 43-51 (ACTUAL - INCORRECTO)

    // Rechazar todo acceso no autorizado
    match /{document=**} {
      allow read, write: if false;
    }
  }  // ← CIERRE EXTRA

  match /lugares/{placeId} {  // ← FUERA DE ESTRUCTURA
    allow read: if isSignedIn();
    allow write: if false;
  }
}  // ← OTRO CIERRE EXTRA
```

---

## 🟢 PROPUESTA NUEVA

```javascript
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
    
    // Lugares - Lectura pública, escritura deshabilitada
    match /lugares/{placeId} {
      allow read: if isSignedIn();
      allow write: if false;
    }
    
    // Rechazar todo acceso no autorizado por defecto
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## ✅ CAMBIOS ESPECÍFICOS

### ✓ Lo que cambia:

1. **Estructura correcta:**
   - Colección `/lugares` ahora DENTRO de la estructura válida
   - Un solo cierre `}` al final del archivo

2. **Permisos actualizados:**
   - `/usuarios/{userId}` → Acceso solo del owner + App Check
   - `/mascotas/{mascotaId}` → Acceso solo del owner + App Check  
   - `/lugares/{placeId}` → Lectura pública, escritura deshabilitada
   - `/{document=**}` → Deniega TODO por defecto

3. **App Check:**
   - OBLIGATORIO para TODAS las operaciones
   - Si App Check no está configurado → Usuarios NO pueden acceder

---

## ⚠️ IMPACTO EN USUARIOS

| Acción | Antes | Después |
|--------|-------|---------|
| Subir foto mascota | ✓ Funciona (si auth) | ✓ Funciona (si auth + appCheck) |
| Leer mascota propia | ✓ Funciona | ✓ Funciona (si appCheck) |
| Crear veterinaria favorita | ✓ Funciona | ✓ Funciona (si appCheck) |
| Acceder a /lugares | ❌ Error/Sin permisos | ✓ Funciona (si auth) |

---

## 🔧 CÓMO DESPLEGAR

### Opción 1: Firebase CLI (Recomendado)

```bash
# 1. Revisar cambios (dry-run)
firebase deploy --only firestore:rules --dry-run

# 2. Si todo OK, desplegar
firebase deploy --only firestore:rules

# 3. Verificar en Firebase Console
# → Firestore → Rules → Revisar cambios
```

### Opción 2: Firebase Console (Manual)

```
1. Abrir https://console.firebase.google.com
2. Proyecto: ashbis-ae5b2
3. Firestore → Rules
4. Copiar TODA la estructura nueva
5. Click "Publish"
```

---

## 🧪 VALIDACIÓN DESPUÉS DE DESPLEGAR

Ejecutar pruebas:

```bash
# Test 1: Lectura de usuario propio
✓ GET /usuarios/{uid} como user X → DEBE FUNCIONAR

# Test 2: Lectura de mascota propia
✓ GET /mascotas/{id} como owner → DEBE FUNCIONAR

# Test 3: Lectura de mascota de otro
✗ GET /mascotas/{id} como otro user → DEBE FALLAR

# Test 4: Lectura de lugares
✓ GET /lugares/{id} como signed in → DEBE FUNCIONAR

# Test 5: Lectura de lugares sin sesión
✗ GET /lugares/{id} como anónimo → DEBE FALLAR (por falta de auth)
```

---

# CAMBIO MANUAL 2: Storage Rules

**Archivo:** `storage.rules`  
**Impacto:** ALTO - Afecta carga de fotos  
**Estado:** ✅ VERIFICADO - NO REQUIERE CAMBIOS

---

## 🟢 ESTADO ACTUAL (CORRECTO)

```javascript
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

**✅ Puntos Positivos:**
- ✓ Estructura correcta
- ✓ Validaciones robustas
- ✓ Type checking
- ✓ Size checking
- ✓ App Check requerido

**⚠️ Única Consideración:**
- App Check es OBLIGATORIO
- Si App Check falla → Usuarios NO pueden subir fotos
- Considerar fallback si necesario

---

## 🎯 RECOMENDACIÓN

✅ **Storage rules están correctas**  
**Acción:** NO modificar

---

# CAMBIO MANUAL 3: Eliminación de carpetas completas

**Carpeta a eliminar:** `src/app/mascota-detalle/`  
**Tamaño:** 4 archivos (~200 líneas)  
**Riesgo:** 🔴 ALTO - Cambio irreversible

---

## 📂 ESTRUCTURA

```
src/app/
├── mascota-detalle/                    ← ELIMINAR
│   ├── mascota-detalle.component.ts
│   ├── mascota-detalle.component.html
│   ├── mascota-detalle.component.scss
│   └── mascota-detalle.component.spec.ts
│
├── pages/
│   └── mascota-detalle/                ← MANTENER (usado)
│       ├── mascota-detalle.component.ts
│       ├── mascota-detalle.component.html
│       ├── mascota-detalle.component.scss
│       └── mascota-detalle.component.spec.ts
```

---

## 🔍 VERIFICACIÓN

**¿Realmente no se usa?**

```bash
# Búsqueda 1: Rutas
grep -r "mascota-detalle" src/app/app.routes.ts
→ SOLO resultado: './pages/mascota-detalle/mascota-detalle.component'
→ La ruta SOLO carga desde /pages/, NO desde raíz

# Búsqueda 2: Imports
grep -r "mascota-detalle.component" src/ --include="*.ts"
→ SOLO resultados: Definiciones y spec files
→ NO hay imports en otros componentes

# Búsqueda 3: Selector
grep -r "app-mascota-detalle" src/
→ SOLO resultados: Definición del componente
→ NO se usa en templates
```

**Conclusión:** ✅ 100% SEGURO ELIMINAR

---

## 🚀 CÓMO PROCEDER

### OPCIÓN A: Eliminar via terminal (Rápido)
```bash
rm -r src/app/mascota-detalle/
# O en Windows:
rmdir /s src\app\mascota-detalle\
```

### OPCIÓN B: Eliminar via VS Code (Más seguro)
```
1. Click derecho en src/app/mascota-detalle/
2. "Delete Folder"
3. Confirmar eliminación
```

### OPCIÓN C: Hacer backup primero (Más prudente)
```bash
# 1. Copiar a temporal
cp -r src/app/mascota-detalle/ _backup_mascota-detalle/

# 2. Eliminar
rm -r src/app/mascota-detalle/

# 3. Compilar para verificar
npm run build
```

---

## ✅ VALIDACIÓN DESPUÉS

```bash
# 1. Compilar
npm run build
# Debe completar SIN ERRORES

# 2. Verificar no hay referencias
grep -r "src/app/mascota-detalle" src/
# Debe retornar: NO MATCHES

# 3. Git status
git status
# Debe mostrar: src/app/mascota-detalle/ como DELETED
```

---

# 🧪 TAMBIÉN PREPARADO PARA REVISIÓN

## Eliminación de app2/

**Ubicación:** Raíz del proyecto  
**Contenido:** Copia completa del proyecto  
**Tamaño:** ~100MB  
**Razón:** Desconocida - posible backup antiguo

**Acción recomendada:**
- ✓ Eliminar (NO es usado)
- ✓ O conservar como backup documentado

---

---

# 📋 CHECKLIST PARA APROBAR CAMBIOS MANUALES

**Por favor confirma (✅/❌):**

## Firestore Rules
- ✅/❌ Leí la estructura propuesta
- ✅/❌ Entiendo que afecta permisos EN VIVO
- ✅/❌ Confirmo desplegar firestore.rules DESPUÉS de Fase A/B
- ✅/❌ Entiendo el impacto en App Check

## Storage Rules
- ✅/❌ Confirmo que NO se modifiquen (están correctas)

## Eliminación carpeta mascota-detalle/
- ✅/❌ Confirmo que es seguro eliminar (0 referencias)
- ✅/❌ Autorizo eliminación de la carpeta
- ✅/❌ Después de Fase A/B y compilar sin errores

## app2/
- ✅/❌ Eliminar directorio app2/ completo
- ✅/❌ O documentar su propósito y conservar

---

# ⚠️ RESUMEN FINAL

| Item | Tipo | Acción | Riesgo |
|------|------|--------|--------|
| firestore.rules | Corrección | Desplegar después | 🔴 ALTO |
| storage.rules | Verificación | NO cambiar | 🟢 BAJO |
| mascota-detalle/ | Eliminación | Eliminar después | 🟡 MEDIO |
| app2/ | Limpieza | TBD | 🟢 BAJO |

**Orden recomendado:**
1. ✓ Aplicar Fase A/B automática
2. ✓ Compilar y validar
3. ✓ Eliminar carpetas manualmente
4. ✓ Compilar nuevamente
5. ✓ Desplegar firestore.rules
6. ✓ Testing final

---

**¿Aprobado para proceder con cambios manuales?**

**Próximo paso:** Esperar confirmación sobre AMBOS documentos:
- PHASE_A_B_REVIEW.md (cambios automáticos)
- MANUAL_REVIEW.md (cambios manuales)
