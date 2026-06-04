# 🚀 PLAN DE ACCIÓN AUTORIZADO - PROYECTO ASHBIS

**Estado:** ⏸️ PENDIENTE APROBACIÓN DEL USUARIO PARA PROCEDER

---

## 📌 REQUISITO ANTES DE EMPEZAR

**El usuario DEBE leer y aprobar este plan.**

✅ He realizado auditoría completa sin cambios  
✅ He generado dos reportes detallados:
- `AUDIT_REPORT.md` - Informe ejecutivo
- `AUDIT_TECHNICAL_VERIFICATION.md` - Detalles técnicos

⏸️ **AHORA REQUIERO APROBACIÓN PARA LOS SIGUIENTES CAMBIOS**

---

## 🎯 FASES DE IMPLEMENTACIÓN

### FASE 1: CORRECCIONES CRÍTICAS (🔴)
**Duración estimada:** 30 minutos  
**Riesgo:** BAJO

#### 1.1 Eliminar ruta duplicada
**Archivo:** `src/app/app.routes.ts`  
**Líneas a eliminar:** 83-90

```diff
-  {
-    path: 'carnet-mascota',
-    loadComponent: () => import('./carnet-mascota/carnet-mascota.page')
-      .then( m => m.CarnetMascotaPage)
-  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  }
```

**Verificación:** Después del cambio, navegar a `/tabs/carnet/:id` debe funcionar

#### 1.2 Eliminar componente duplicado
**Directorio a eliminar:** `src/app/mascota-detalle/`

```bash
# Estructura actual
src/app/
├── mascota-detalle/          ← ELIMINAR (duplicado)
│   ├── mascota-detalle.component.ts
│   ├── mascota-detalle.component.html
│   ├── mascota-detalle.component.scss
│   └── mascota-detalle.component.spec.ts
├── pages/
│   └── mascota-detalle/      ← MANTENER (usado)
│       ├── mascota-detalle.component.ts
│       ├── mascota-detalle.component.html
│       ├── mascota-detalle.component.scss
│       └── mascota-detalle.component.spec.ts
```

**Verificación:** Ruta `/tabs/mascota-detalle/123` sigue funcionando

#### 1.3 Corregir Firestore rules
**Archivo:** `firestore.rules`  
**Acción:** Reorganizar estructura malformada

```diff
  // Rechazar todo acceso no autorizado
  match /{document=**} {
    allow read, write: if false;
  }
-}
-
-  match /lugares/{placeId} {
-    allow read: if isSignedIn();
-    allow write: if false;
-  }
-}
+ 
+  // Lugares - Lectura pública, escritura deshabilitada
+  match /lugares/{placeId} {
+    allow read: if isSignedIn();
+    allow write: if false;
+  }
}
```

**Verificación:** Ejecutar `firebase deploy --only firestore:rules` sin errores

---

### FASE 2: LIMPIEZA (🟡)
**Duración estimada:** 15 minutos  
**Riesgo:** MUY BAJO

#### 2.1 Eliminar auth-module.ts
**Archivo:** `src/app/auth/auth-module.ts`  
**Acción:** Eliminar completamente

**Razón:** No se importa en ningún lado, es residuo de migración a standalone

#### 2.2 Eliminar auth-routing-module.ts
**Archivo:** `src/app/auth/auth-routing-module.ts`  
**Acción:** Eliminar completamente

**Razón:** No tiene rutas (vacío), solo importado por auth-module.ts (que también se elimina)

#### 2.3 Limpiar código comentado
**Archivos:** Múltiples  
**Acción:** Ejecutar búsqueda y eliminar

```bash
# Buscar bloques comentados largos
grep -r "^[[:space:]]*//" src/app/ | grep -E "(NgModule|import|export)" | head -20
```

---

### FASE 3: REMOVER MÉTODOS MUERTOS (🟡)
**Duración estimada:** 10 minutos  
**Riesgo:** BAJO

#### 3.1 Eliminar createDocumentID()
**Archivo:** `src/app/firebase/firestore.ts`  
**Líneas:** 115-119

```diff
-  private createDocumentID(): string {
-    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
-  }
-
```

**Verificación:** Buscar referencias → Debe haber 0

#### 3.2 Eliminar createIdDoc()
**Archivo:** `src/app/firebase/firestore.ts`  
**Líneas:** 120-122

```diff
-  private createIdDoc(): string {
-    return `id_${uuid()}`;
-  }
-
```

**Verificación:** Buscar referencias → Debe haber 0

---

### FASE 4: MIGRACIÓN GOOGLE MAPS (🔴 CRÍTICA)
**Duración estimada:** 4-6 horas  
**Riesgo:** ALTO - Requiere testing extenso

#### 4.1 Remover Leaflet de angular.json
**Archivo:** `angular.json`  
**Línea:** 38

```diff
  "styles": [
    "src/global.scss",
    "src/theme/variables.scss",
-   "node_modules/leaflet/dist/leaflet.css"
  ]
```

#### 4.2 Reescribir home.component.ts
**Archivo:** `src/app/home/home.component.ts`

**Cambios:**
- Remover: `declare const L: any;` (L30)
- Remover: `OVERPASS_SERVERS` (L107-110)
- Remover: `cargarLeaflet()` (L143-152)
- Remover: `initMap()` (L154-165)
- Remover: `Marcador` interface layer config
- **Implementar:** Google Places API initialization
- **Implementar:** Google Maps markers

**Pseudo-código:**
```typescript
import { GoogleMapsModule } from '@angular/google-maps';

export class HomePage {
  map: google.maps.Map;
  placesService: google.maps.places.PlacesService;
  
  ngOnInit() {
    this.initGoogleMap();  // ← Nueva implementación
    this.loadGooglePlaces();
  }
  
  searchNearbyPlaces(coords: { lat, lng }) {
    const request = {
      location: new google.maps.LatLng(coords.lat, coords.lng),
      radius: 5000,
      type: this.currentSearchType === 'veterinary_care' 
        ? 'veterinary_care' 
        : 'pet_store'
    };
    
    this.placesService.nearbySearch(request, (results, status) => {
      // Procesar resultados
      // Crear marcadores de Google Maps
      // Mostrar panel de información
    });
  }
}
```

**Verificación:** 
- Mapa carga en home
- Botones "Veterinaria" y "Tienda" funcionan
- Marcadores se muestran correctamente
- Panel de información se actualiza

#### 4.3 Actualizar template home.component.html
**Cambios:**
- Mantener: Estructura HTML existente
- Actualizar: `<google-map>` component con proper initialization
- Mantener: Botones de búsqueda
- Mantener: Panel de información lateral

#### 4.4 Remover @angular/google-maps de angular.json (si aplica)
**Verificación:** Debe estar en package.json para Angular 20

---

### FASE 5: MEJORAR CHAT IA (🟡 ALTA)
**Duración estimada:** 3-4 horas  
**Riesgo:** MEDIO

#### 5.1 Crear ia.service.ts
**Ubicación:** `src/app/services/ia.service.ts`

**Responsabilidades:**
- Gestionar historial de conversaciones
- Persistencia en localStorage/IndexedDB
- Validación de respuestas
- Retry logic
- Rate limiting

```typescript
@Injectable({ providedIn: 'root' })
export class IaService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(Storage);
  
  async enviarMensaje(prompt: string, categoria: string, mascota: string) {
    // 1. Validar entrada
    // 2. Registrar en historial local
    // 3. Llamar a aiProxy
    // 4. Guardar respuesta en Firestore (opcional)
    // 5. Retornar respuesta validada
  }
  
  async obtenerHistorial(userId: string): Promise<Conversacion[]> {
    // Cargar del storage/Firestore
  }
  
  async guardarConversacion(userId: string, conversacion: Conversacion) {
    // Persistir a Firestore
  }
}
```

#### 5.2 Actualizar chat-ia.component.ts
**Cambios:**
- Inyectar `IaService`
- Reemplazar `AiProxyService` directo con `IaService`
- Agregar listeners para recuperar historial
- Implementar UI para mostrar historial anterior

#### 5.3 Mejorar error handling en functions
**Archivo:** `functions/src/index.ts`

**Mejoras:**
- Validaciones más robustas
- Retries automáticos
- Logging mejorado
- Timeouts configurables

---

### FASE 6: REVISAR FIREBASE (🟠 MEDIA)
**Duración estimada:** 2 horas  
**Riesgo:** BAJO

#### 6.1 Validar firestore.rules
```bash
firebase deploy --only firestore:rules --dry-run
```

#### 6.2 Validar storage.rules
```bash
firebase deploy --only storage --dry-run
```

#### 6.3 Verificar App Check
- Confirmar que appCheckSiteKey está en environment.ts
- Verificar que app check está habilitado en Firebase Console

#### 6.4 Audit de colecciones
- [ ] /usuarios/{userId} - Acceso correcto
- [ ] /mascotas/{mascotaId} - Permisos por owner
- [ ] /lugares/{placeId} - Permisos de lectura
- [ ] /veterinariasFavoritas - Acceso owner

---

### FASE 7: TESTING Y VALIDACIÓN (✅)
**Duración estimada:** 2-3 horas

#### Test cases por fase:

**Fase 1 (Routes):**
- [ ] Navegar a `/tabs/carnet/123` → Carga mascota
- [ ] Navegar a `/tabs/mascota-detalle/456` → Carga detalle
- [ ] Componente duplicado removido ✅

**Fase 3 (Google Maps):**
- [ ] Mapa se renderiza en home
- [ ] Click "Veterinaria" → Busca veterinarias
- [ ] Click "Tienda" → Busca tiendas
- [ ] Marcadores aparecen en mapa
- [ ] Panel lateral muestra info correcta
- [ ] Editar información funciona
- [ ] Agregar a favoritos funciona

**Fase 5 (Chat IA):**
- [ ] Conversación carga desde historial
- [ ] Enviar mensaje funciona
- [ ] Respuesta se recibe correctamente
- [ ] Historial persiste después de navegar

**Fase 6 (Firebase):**
- [ ] Rules se despliegan sin errores
- [ ] App Check valida requests
- [ ] Firestore permisos funcionan

---

## 🔄 ORDEN DE EJECUCIÓN

```
1. Fase 1: Correcciones críticas (Riesgos bajos)
   ↓
2. Fase 2: Limpieza (Muy seguros)
   ↓
3. Fase 3: Remover métodos muertos (Seguros)
   ↓
4. Fase 4: Google Maps (⚠️ RIESGO ALTO - Requiere testing)
   ↓
5. Fase 5: Chat IA (Testing extenso)
   ↓
6. Fase 6: Firebase (Validación)
   ↓
7. Fase 7: Testing final (Verificación completa)
```

---

## ⚠️ ADVERTENCIAS IMPORTANTES

### ANTES DE EMPEZAR

1. **BACKUP:** Hacer commit en git antes de cualquier cambio
   ```bash
   git add .
   git commit -m "Audit report before cleanup"
   git branch audit-backup
   ```

2. **TESTING:** Firebase changes afectan usuarios EN VIVO
   - Usar `--dry-run` first
   - Backup rules actuales

3. **GOOGLE MAPS:** Requiere API key
   ```typescript
   // environment.ts
   googleMapsApiKey: 'YOUR_KEY_HERE'
   ```

4. **LEAFLET:** Habrá cambios en:
   - HTML (home.component.html)
   - CSS (global.scss - revisar referencias)
   - JavaScript (home.component.ts - completo rewrite)

---

## 📊 MATRIZ DE RIESGO

| Fase | Riesgo | Dependencias | Rollback |
|------|--------|--------------|----------|
| 1 | 🟢 BAJO | Routes | Git revert |
| 2 | 🟢 BAJO | None | Git revert |
| 3 | 🟢 BAJO | None | Git revert |
| 4 | 🔴 ALTO | Google Maps API, CSS | Manual |
| 5 | 🟡 MEDIO | Backend ready | Manual |
| 6 | 🟢 BAJO | Firebase projects | Git revert |
| 7 | 🟠 MEDIA | E2E environments | Manual |

---

## ✅ CHECKLIST FINAL

**Antes de CADA fase:**
- [ ] Git commit ejecutado
- [ ] Rama de backup creada
- [ ] Plan leído completamente
- [ ] Archivos identificados correctamente

**Después de CADA fase:**
- [ ] Cambios aplicados correctamente
- [ ] Sin errores de compilación
- [ ] Tests pasan (si existen)
- [ ] Git commit con cambios

**Antes de DEPLOY:**
- [ ] Todas las fases completadas
- [ ] Todos los tests pasan
- [ ] Funcionalidad validada
- [ ] Firebase rules sin errores
- [ ] Android/iOS builds compilan

---

## 🎯 PRÓXIMOS PASOS

**1. Usuario lee y aprueba este plan**

**2. Usuario indica:**
- ¿Cuál fase quiere que empiece?
- ¿Todas las fases o solo algunas?
- ¿Quiere que agrego testing antes de aplicar cambios?

**3. Usuario confirma:**
- Tiene backup de código
- Tiene API key para Google Maps (para Fase 4)
- Tiene disponibilidad para testing

**Luego procederemos con los cambios.**

---

**📝 Plan creado:** 2025-06-04  
**⏸️ Estado:** PENDIENTE APROBACIÓN  
**👤 Requiere confirmación de:** Usuario ASHBIS
