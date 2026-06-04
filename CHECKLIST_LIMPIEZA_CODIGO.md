# ✅ CHECKLIST DE LIMPIEZA - CÓDIGO MUERTO

Usa este archivo para rastrear la limpieza del código no utilizado. ✔️ para completar.

---

## FASE 1: CRÍTICA ⚠️

Estos cambios pueden causar fallos si se hacen incorrectamente. Revisar después de cada cambio.

### Rutas en app.routes.ts
- [ ] Línea 43: REVISAR ruta `carnet/:id` (¿se llama desde router.navigate?)
- [ ] Línea 83-86: ELIMINAR ruta `carnet-mascota` (duplicada)
  ```bash
  # Antes de eliminar, buscar referencias:
  grep -r "navigate.*carnet-mascota\|carnet-mascota" src/
  ```
- [ ] **DESPUÉS**: Ejecutar tests/compilar para verificar no hay breakage

### Componente Duplicado mascota-detalle
- [ ] REVISAR: [src/app/mascota-detalle/](src/app/mascota-detalle/) 
- [ ] REVISAR: [src/app/pages/mascota-detalle/](src/app/pages/mascota-detalle/) - versión usada
- [ ] Comparar ambos para asegurar tienen mismo código
- [ ] ELIMINAR: `src/app/mascota-detalle/` (la carpeta completa)
  ```bash
  rm -rf src/app/mascota-detalle/
  ```
- [ ] **DESPUÉS**: ng serve/ng build para verificar la ruta `mascota-detalle/:id` aún funciona

---

## FASE 2: MÉTODOS NO USADOS 🟡

### firestore.ts
- [ ] Línea 115: ELIMINAR `createDocumentID()` 
  ```typescript
  // ❌ BORRAR
  createDocumentID(data: any, enlace: string, idDoc: string) {
    const document = doc(this.firestore, `${enlace}/${idDoc}`);
    return setDoc(document, data);
  }
  ```
  - Verificar primero: `grep -r "createDocumentID" src/`
  - Debe dar 0 resultados
  
- [ ] Línea 120: ELIMINAR `createIdDoc()`
  ```typescript
  // ❌ BORRAR
  createIdDoc() { return uuidv4(); }
  ```
  - Verificar: `grep -r "createIdDoc" src/`
  - Debe dar 0 resultados
  - Nota: `createId()` en L121 SÍ se usa, mantenerlo

- [ ] **DESPUÉS**: ng build --prod para verificar no hay errores

---

## FASE 3: CÓDIGO COMENTADO 🟠

### Eliminar archivos vacíos comentados

- [ ] ELIMINAR: [src/app/auth/auth-module.ts](src/app/auth/auth-module.ts)
  ```bash
  rm src/app/auth/auth-module.ts
  ```
  - Verificar primero: `grep -r "AuthModule\|auth-module" src/`
  - Debe dar 0 resultados (no se importa)

- [ ] ELIMINAR: [src/app/auth/auth-routing-module.ts](src/app/auth/auth-routing-module.ts)
  ```bash
  rm src/app/auth/auth-routing-module.ts
  ```
  - Verificar: `grep -r "AuthRoutingModule\|auth-routing-module" src/`
  - Debe dar 0 resultados

- [ ] **DESPUÉS**: Verificar rutas de auth aún funcionan (login, registro, forgot-password)

---

## FASE 4: DEPENDENCIAS NO USADAS 🟠

### @angular/google-maps

- [ ] **DECISIÓN REQUERIDA**:
  - ¿Proyecto usa Google Maps? 
    - ❌ NO → Ir a paso siguiente
    - ✅ SÍ → No eliminar, implementar importes correctamente
  
- [ ] Si NO se usa: `npm remove @angular/google-maps`
  - Verificar antes: `grep -r "google-maps\|GoogleMap" src/`
  - Actualizar [package.json](package.json) y hacer `npm install`

- [ ] **DESPUÉS**: ng build para verificar

---

## FASE 5: TESTS .spec.ts 🔵

Estos cambios son opcionales pero recomendados. Elige UNA estrategia:

### Opción A: ELIMINAR tests triviales (Rápido - 10 min)

```bash
# Listar archivos .spec.ts que solo tienen "should be created"
find src -name "*.spec.ts" -exec grep -l "should be created" {} \;
```

- [ ] Eliminar archivos .spec.ts listados (que SÍ necesitan tests reales):
  - [ ] `src/app/firebase/firestore.spec.ts` (importante)
  - [ ] `src/app/firebase/authentication.spec.ts` (importante)
  - [ ] `src/app/chat-ia/chat-ia.component.spec.ts`
  - [ ] `src/app/home/home.component.spec.ts`
  - [ ] Y otros menos críticos...

  ```bash
  rm src/app/firebase/firestore.spec.ts
  rm src/app/firebase/authentication.spec.ts
  # ... etc
  ```

### Opción B: IMPLEMENTAR tests reales (Ideal - 2-4 horas)

- [ ] Priorizar tests para:
  - `firestore.ts`: Methods de CRUD, autenticación
  - `authentication.ts`: Login, logout, Google Sign-in
  - `security.service.ts`: sanitizeText, sanitizeFirestoreObject
  - `home.component.ts`: Map functionality

- [ ] Mantener pero mejorar tests para:
  - Todos los demás componentes

---

## FASE 6: HOUSEKEEPING 🏠

### Directorio app2/

- [ ] REVISAR: ¿Qué es [app2/](app2/)?
  - Parecece ser copia/backup del proyecto
  
- [ ] **DECISIÓN REQUERIDA**:
  - Eliminar (es backup): `rm -rf app2/`
  - Mantener (es proyecto separado): Documentar propósito en README
  - Mover a otra rama/repositorio

- [ ] [ ] Si eliminas: Actualizar .gitignore si es necesario

---

## VERIFICACIÓN FINAL ✅

Después de completar todas las fases:

```bash
# 1. Verificar build
ng build --prod

# 2. Ejecutar tests (si existen)
ng test

# 3. Servir localmente
ng serve

# 4. Probar rutas principales:
- [ ] Login: http://localhost:4200/login
- [ ] Registro: http://localhost:4200/registro
- [ ] Forgot Password: http://localhost:4200/forgot-password
- [ ] Tabs/Home: http://localhost:4200/tabs/home
- [ ] Listar Mascotas: http://localhost:4200/tabs/listar-mascotas
- [ ] Mascota Detalle: http://localhost:4200/tabs/mascota-detalle/[id]
- [ ] Carnet: http://localhost:4200/carnet/[id]
- [ ] Chat IA: http://localhost:4200/chat-ia
- [ ] Perfil: http://localhost:4200/tabs/perfil

# 5. Revisar console para errores
# 6. Commit cambios con mensaje claro
git add -A
git commit -m "cleanup: remove dead code - duplicated routes, unused methods, empty test files"
```

---

## ESTADÍSTICAS

| Métrica | Antes | Después | Ahorro |
|---------|-------|---------|--------|
| Líneas código muerto | ~100 | ~0 | ✅ 100% |
| Archivos .spec.ts triviales | 18+ | 0 | ✅ limpio |
| Métodos sin usar | 2 | 0 | ✅ limpio |
| Rutas duplicadas | 1 | 0 | ✅ limpio |
| Componentes duplicados | 1 | 0 | ✅ limpio |

---

## NOTAS IMPORTANTES

⚠️ **Siempre**:
1. Hacer backup o crear rama antes de limpieza
2. Revisar cada cambio antes de eliminar
3. Ejecutar tests después de cada fase
4. Usar `git diff` para revisar cambios

📌 **Problemas conocidos**:
- auth-module y auth-routing-module están vacíos desde que proyecto migró a standalone components
- mascota-detalle duplicado posiblemente del refactoring anterior
- Tests triviales generados por generador Angular (ng generate)

---

**Última actualización**: 2026-06-04  
**Estimado de tiempo total**: 1-2 horas (depende de si haces tests reales)
