# 📋 ANÁLISIS DE CÓDIGO NO UTILIZADO - CODEBASE ASHBIS

**Fecha**: 2026-06-04  
**Ramas analizadas**: `src/app/services/`, `src/app/firebase/`, `src/app/**/*.ts`

---

## 🔴 PROBLEMAS CRÍTICOS

### 1. RUTAS DUPLICADAS EN app.routes.ts
**Archivo**: [app.routes.ts](app.routes.ts)  
**Líneas**: 43 y 83-86

```typescript
// ❌ CONFLICTO: Ruta 1
{
  path: 'carnet/:id',
  loadComponent: () => import('./carnet-mascota/carnet-mascota.page')
}

// ❌ CONFLICTO: Ruta 2 (NUNCA se ejecutará)
{
  path: 'carnet-mascota',
  loadComponent: () => import('./carnet-mascota/carnet-mascota.page')
}
```

**Impacto**: La segunda ruta es inalcanzable. Angular ejecutará la primera coincidencia.  
**Recomendación**: Eliminar línea 83-86.

---

## 🟡 PROBLEMAS ALTOS

### 2. MÉTODOS NO UTILIZADOS EN FirestoreService

**Archivo**: [src/app/firebase/firestore.ts](src/app/firebase/firestore.ts)

#### a) `createDocumentID()` - LÍNEA 115
```typescript
createDocumentID(data: any, enlace: string, idDoc: string) {
  const document = doc(this.firestore, `${enlace}/${idDoc}`);
  return setDoc(document, data);
}
```
**Búsqueda en codebase**: ❌ **0 referencias encontradas**  
**Estado**: **NO SE USA**

#### b) `createIdDoc()` - LÍNEA 120
```typescript
createIdDoc() { return uuidv4(); }
```
**Búsqueda en codebase**: ❌ **0 referencias encontradas**  
**Estado**: **NO SE USA**

**Nota**: Existe `createId()` en la línea 121 que SÍ se usa (mascota-editar, crear-mascotas).

---

### 3. COMPONENTE DUPLICADO: mascota-detalle

**Ubicaciones**:
- [src/app/mascota-detalle/mascota-detalle.component.ts](src/app/mascota-detalle/mascota-detalle.component.ts)
- [src/app/pages/mascota-detalle/mascota-detalle.component.ts](src/app/pages/mascota-detalle/mascota-detalle.component.ts)

**Comparación**:
- Ambos tienen la misma funcionalidad
- Ambos importan las mismas dependencias (Firestore, Auth)
- Ambos implementan: Vacunas, Exámenes, Medicamentos

**Rutas en app.routes.ts**:
```typescript
{
  path: 'mascota-detalle/:id',
  loadComponent: () => import('./pages/mascota-detalle/mascota-detalle.component')
}
```
Usa `/pages/`, pero `/mascota-detalle/` duplicado permanece sin referencias.

**Recomendación**: Eliminar `src/app/mascota-detalle/` y mantener `src/app/pages/mascota-detalle/`

---

### 4. CÓDIGO COMENTADO EXTENSO

#### a) [src/app/auth/auth-module.ts](src/app/auth/auth-module.ts) - LÍNEAS 11-23
```typescript
// @NgModule({
//   declarations: [
//     LoginComponent,
//     RegistroComponent
//   ],
//   imports: [
//     CommonModule,
//     AuthRoutingModule,
//     IonicModule,
//     FormsModule,
//     ReactiveFormsModule
//   ]
// })
export class AuthModule { }  // ← Clase vacía
```
**Estado**: 13 líneas comentadas  
**Uso**: ❌ Módulo no usado (proyecto usa standalone components)  
**Recomendación**: Eliminar archivo completo

#### b) [src/app/auth/auth-routing-module.ts](src/app/auth/auth-routing-module.ts) - LÍNEAS 6-9
```typescript
// @NgModule({
//   imports: [RouterModule.forChild(routes)],
//   exports: [RouterModule]
// })
export class AuthRoutingModule { }  // ← Clase vacía
```
**Estado**: 4 líneas comentadas  
**Uso**: ❌ No usado  
**Recomendación**: Eliminar archivo

---

## 🟠 PROBLEMAS MEDIOS

### 5. ARCHIVOS .spec.ts CON TESTS TRIVIALES

**Descripción**: 18 archivos de prueba que solo verifican que el componente se crea, sin tests reales.

| Archivo | Líneas | Tests |
|---------|--------|-------|
| [firebase/firestore.spec.ts](firebase/firestore.spec.ts) | 1-15 | Solo `it('should be created')` |
| [firebase/authentication.spec.ts](firebase/authentication.spec.ts) | 1-15 | Solo `it('should be created')` |
| [chat-ia/chat-ia.component.spec.ts](chat-ia/chat-ia.component.spec.ts) | 1-17 | Solo `it('should be created')` |
| [listar-mascotas/listar-mascotas.component.spec.ts](listar-mascotas/listar-mascotas.component.spec.ts) | 1-17 | Solo `it('should be created')` |
| [app.component.spec.ts](app.component.spec.ts) | 1-13 | Solo `it('should be created')` |
| [home/home.component.spec.ts](home/home.component.spec.ts) | ? | Solo `it('should be created')` |
| [mascota-editar/mascota-editar.component.spec.ts](mascota-editar/mascota-editar.component.spec.ts) | ? | Solo `it('should be created')` |
| [mascota-detalle/mascota-detalle.component.spec.ts](mascota-detalle/mascota-detalle.component.spec.ts) | ? | Solo `it('should be created')` |
| [perfil/perfil.component.spec.ts](perfil/perfil.component.spec.ts) | ? | Solo `it('should be created')` |
| [mascota-qr/mascota-qr.component.spec.ts](mascota-qr/mascota-qr.component.spec.ts) | ? | Solo `it('should be created')` |
| [carnet-mascota/carnet-mascota.page.spec.ts](carnet-mascota/carnet-mascota.page.spec.ts) | ? | Solo `it('should be created')` |
| Y más... | - | - |

**Recomendación**: Implementar tests reales o eliminar archivos .spec.ts vacíos durante limpieza.

---

### 6. DEPENDENCIAS POTENCIALMENTE NO UTILIZADAS

#### a) `@angular/google-maps` ^20.2.14 - ⚠️ **POSIBLE NO USO**

**Ubicación en package.json**: Línea 22  
**Búsqueda en codebase**: ❌ **NO se importa**

```bash
# Resultados de búsqueda:
grep -r "@angular/google-maps" src/  # ❌ NO MATCHES
grep -r "GoogleMap" src/             # ❌ NO MATCHES
grep -r "google.maps" src/           # ❌ NO MATCHES
```

**Proyecto usa**: Leaflet (a través de `declare const L: any` en home.component.ts)

**Recomendación**: 
- Si usas mapas con Leaflet, puedes remover `@angular/google-maps`
- Si planeas migrar a Google Maps, primero implementa la lógica

---

#### b) `html2canvas` ^1.4.1 - ✅ **EN USO**
- [carnet-mascota.page.ts](carnet-mascota/carnet-mascota.page.ts#L6): Import L6
- [carnet-mascota.page.ts](carnet-mascota/carnet-mascota.page.ts#L171): Uso para generar PDF

#### c) `jspdf` ^4.2.1 - ✅ **EN USO**
- [carnet-mascota.page.ts](carnet-mascota/carnet-mascota.page.ts#L7): Import L7
- [carnet-mascota.page.ts](carnet-mascota/carnet-mascota.page.ts#L178): Creación de PDF

#### d) `swiper` ^12.1.3 - ✅ **EN USO**
- [home.component.ts](home/home.component.ts#L21): Import
- [home.component.html](home/home.component.html#L11, L195): Carruseles

#### e) `uuid` ^13.0.0 - ✅ **EN USO**
- [firestore.ts](src/app/firebase/firestore.ts#L7): Import
- [firestore.ts](src/app/firebase/firestore.ts#L121): Método `createId()`

---

## 📁 ESTRUCTURAS DUPLICADAS

### 7. Directorio `app2/` - ANÁLISIS

**Ubicación**: [app2/](app2/)  
**Contenido**: Copia completa de proyecto Angular
- angular.json
- package.json
- tsconfig.json
- src/ (estructura duplicada)

**Propósito**: ❓ Desconocido  
**Recomendación**: 
- Si es backup: documentar y eliminar
- Si es otro proyecto: mover a raíz de workspace o repositorio separado

---

## 📊 RESUMEN ESTADÍSTICO

| Categoría | Cantidad | Severidad |
|-----------|----------|-----------|
| **Rutas duplicadas** | 1 | 🔴 CRÍTICA |
| **Métodos sin usar** | 2 | 🟡 ALTA |
| **Componentes duplicados** | 1 | 🟡 ALTA |
| **Código comentado (líneas)** | ~17 | 🟡 ALTA |
| **Tests triviales (.spec.ts)** | 18+ | 🟠 MEDIA |
| **Dependencias posibles no usadas** | 1 | 🟠 MEDIA |
| **Directorios duplicados** | 1 | 🟠 MEDIA |

---

## ✅ CHECKLIST DE LIMPIEZA RECOMENDADA

### Prioridad 1 (Inmediato - Breaking Changes)
- [ ] Eliminar ruta duplicada `carnet-mascota` en [app.routes.ts](app.routes.ts#L83)
- [ ] Resolver conflicto de componentes `mascota-detalle`:
  - Mantener: `src/app/pages/mascota-detalle/`
  - Eliminar: `src/app/mascota-detalle/`

### Prioridad 2 (Alto - Dead Code)
- [ ] Remover método `createDocumentID()` de [firestore.ts](src/app/firebase/firestore.ts#L115)
- [ ] Remover método `createIdDoc()` de [firestore.ts](src/app/firebase/firestore.ts#L120)
- [ ] Eliminar [auth/auth-module.ts](src/app/auth/auth-module.ts) (clase vacía)
- [ ] Eliminar [auth/auth-routing-module.ts](src/app/auth/auth-routing-module.ts) (clase vacía)

### Prioridad 3 (Verificación - Dependencias)
- [ ] Confirmar si `@angular/google-maps` ^20.2.14 es necesario
  - Si no: remover de [package.json](package.json#L22)
  - Si sí: implementar Google Maps en código

### Prioridad 4 (Opcional - Testing)
- [ ] Evaluar mantener .spec.ts básicos o implementar tests reales
- [ ] Limpiar directorios `app2/` si es backup

---

## 🔧 COMANDOS ÚTILES PARA LIMPIEZA

```bash
# Verificar referencias a métodos eliminados
grep -r "createDocumentID\|createIdDoc" src/

# Remover imports de auth-module
grep -r "AuthModule\|AuthRoutingModule" src/

# Verificar uso de @angular/google-maps
grep -r "google-maps\|GoogleMap" src/

# Buscar tests triviales
grep -r "should be created" src/app/**/*.spec.ts
```

---

**Generado por Auditoría de Código Automática**  
**Análisis completado**: 2026-06-04
