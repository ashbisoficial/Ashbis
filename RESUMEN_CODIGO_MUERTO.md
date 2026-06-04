# 🚀 RESUMEN EJECUTIVO - PROBLEMAS ENCONTRADOS

## Formato Tabla Rápida

### CRÍTICOS 🔴

| Archivo | Línea | Problema | Acción |
|---------|-------|----------|--------|
| [app.routes.ts](app.routes.ts) | 43, 83-86 | Rutas duplicadas: `carnet/:id` y `carnet-mascota` | Eliminar L83-86 |

---

### ALTOS 🟡

| Archivo | Línea | Problema | Acción |
|---------|-------|----------|--------|
| [firebase/firestore.ts](src/app/firebase/firestore.ts) | 115 | Método `createDocumentID()` no se llama nunca | Eliminar método |
| [firebase/firestore.ts](src/app/firebase/firestore.ts) | 120 | Método `createIdDoc()` no se llama nunca | Eliminar método (usar `createId()` en L121) |
| [mascota-detalle/](src/app/mascota-detalle/) | múltiple | Componente duplicado | Eliminar carpeta completa (existe en `pages/`) |
| [auth/auth-module.ts](src/app/auth/auth-module.ts) | 11-23 | 13 líneas comentadas + clase vacía | Eliminar archivo |
| [auth/auth-routing-module.ts](src/app/auth/auth-routing-module.ts) | 6-9 | 4 líneas comentadas + clase vacía | Eliminar archivo |

---

### MEDIOS 🟠

| Archivo | Línea | Problema | Acción |
|---------|-------|----------|--------|
| [package.json](package.json) | 22 | `@angular/google-maps` no se importa | Verificar si se usa; si no, remover |
| Múltiples | - | 18+ archivos .spec.ts solo con test básico "should be created" | Implementar tests reales o eliminar |
| [app2/](app2/) | - | Directorio duplicado (copia del proyecto) | Eliminar o documentar propósito |

---

## 📋 Métodos/Variables POR ARCHIVO

### src/app/firebase/firestore.ts
```
✅ USADOS:
- createDocument()           → registro.component, crear-mascotas
- createId()                → crear-mascotas.component
- getCollectionChanges()    → mascota-detalle.component
- getDocumentChanges()      → perfil, mascota-detalle, mascota-qr
- getDocument()             → carnet-mascota, login
- getLugaresInfo()          → home.component
- saveLugarInfo()           → home.component
- updatePet(), deletePet()  → mascota-editar
- [Citas, Vacunas, Exámenes, Medicamentos, Veterinarias]: Todos usados

❌ NO USADOS:
- createDocumentID()    (L115)  → 0 referencias
- createIdDoc()         (L120)  → 0 referencias
```

### src/app/services/security.service.ts
```
✅ USADOS:
- sanitizeText()              → usado en 8+ ubicaciones
- sanitizeFirestoreObject()   → usado en 3 ubicaciones
- canAttemptLogin()           → login.component.ts
- resetLoginAttempts()        → login.component.ts
```

### src/app/services/ai-proxy.service.ts
```
✅ USADOS:
- sendMessage()     → chat-ia.component.ts
```

---

## 🗂️ Componentes .spec.ts Básicos (Solo "should be created")

```
1. firebase/firestore.spec.ts
2. firebase/authentication.spec.ts
3. app.component.spec.ts
4. chat-ia/chat-ia.component.spec.ts
5. mascota-editar/mascota-editar.component.spec.ts
6. mascota-detalle/mascota-detalle.component.spec.ts
7. perfil-mascota/perfil-mascota.component.spec.ts
8. crear-mascotas/crear-mascotas.component.spec.ts
9. listar-mascotas/listar-mascotas.component.spec.ts
10. home/home.component.spec.ts
11. perfil/perfil.component.spec.ts
12. mascota-qr/mascota-qr.component.spec.ts
13. carnet-mascota/carnet-mascota.page.spec.ts
14. tabs/tabs.component.spec.ts
15-18. Otros componentes con pattern similar
```

---

## 📦 Análisis de Dependencias

| Paquete | Versión | ¿Usado? | Ubicación |
|---------|---------|--------|-----------|
| @angular/google-maps | ^20.2.14 | ❌ NO | - (Project usa Leaflet) |
| html2canvas | ^1.4.1 | ✅ SÍ | carnet-mascota.page.ts |
| jspdf | ^4.2.1 | ✅ SÍ | carnet-mascota.page.ts |
| swiper | ^12.1.3 | ✅ SÍ | home.component |
| uuid | ^13.0.0 | ✅ SÍ | firestore.ts |
| angularx-qrcode | ^20.0.0 | ✅ SÍ | mascota-qr, carnet-mascota |
| Otros (Firebase, Angular) | - | ✅ SÍ | Múltiples ubicaciones |

---

## 🎯 Plan de Limpieza Recomendado

### FASE 1: CRÍTICA (30 min)
```bash
# 1. Eliminar ruta duplicada
  src/app/app.routes.ts: L83-86

# 2. Eliminar componente duplicado
  rm -rf src/app/mascota-detalle/

# 3. Remover métodos no usados
  src/app/firebase/firestore.ts: Eliminar createDocumentID() + createIdDoc()
```

### FASE 2: LIMPIEZA (20 min)
```bash
# 1. Eliminar auth modules
  rm src/app/auth/auth-module.ts
  rm src/app/auth/auth-routing-module.ts

# 2. Verificar dependencias
  package.json: ¿Mantener @angular/google-maps?
```

### FASE 3: TESTING (Opcional - 1-2 horas)
```bash
# 1. Implementar tests reales en .spec.ts críticos
# 2. O eliminar .spec.ts que solo tienen "should be created"
```

### FASE 4: HOUSEKEEPING (10 min)
```bash
# 1. Evaluar app2/ → documentar o eliminar
# 2. Revisar archivos comentados restantes
```

---

**Total de líneas de código muerto identificadas**: ~100  
**Estimado de ahorro**: ~150KB en bundle final
