# 🔍 REVISIÓN PREVIA - FASE A & B

**Estado:** CAMBIOS PREPARADOS - PENDIENTE CONFIRMACIÓN  
**Fecha:** 2025-06-04

---

## ⚠️ IMPORTANTE

Los siguientes cambios están **LISTOS PARA APLICAR** pero requieren tu confirmación antes de ejecutarlos. Cada sección muestra:
- 🟦 ANTES (código original)
- 🟩 DESPUÉS (código propuesto)
- ✅ IMPACTO

---

# FASE A - LIMPIEZA SEGURA

## CAMBIO 1.1: Eliminar ruta duplicada en app.routes.ts

**Archivo:** `src/app/app.routes.ts`  
**Líneas:** 86-90  
**Razón:** Ruta `/carnet-mascota` ya existe dentro de `/tabs` en línea 43

### 🔴 ANTES
```typescript
  {
    path: '**',
    redirectTo: 'login',
  },
  {
    path: 'carnet-mascota',
    loadComponent: () => import('./carnet-mascota/carnet-mascota.page').then( m => m.CarnetMascotaPage)
  }
];
```

### 🟢 DESPUÉS
```typescript
  {
    path: '**',
    redirectTo: 'login',
  }
];
```

**✅ Impacto:** 
- ✓ La ruta `/tabs/carnet/:id` sigue funcionando
- ✓ Se elimina conflicto de rutas
- ✓ Sin cambios en navegación existente

---

## CAMBIO 2: Eliminar archivo auth-module.ts

**Archivo a eliminar:** `src/app/auth/auth-module.ts`  
**Tamaño:** 24 líneas  
**Razón:** Completamente comentado, no se importa en ningún lado

### 🔴 CONTENIDO ACTUAL (SERÁ ELIMINADO)
```typescript
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { AuthRoutingModule } from './auth-routing-module';
import { LoginComponent } from './pages/login/login.component';
import { RegistroComponent } from './pages/registro/registro.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';


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
export class AuthModule { }
```

**🔍 Búsqueda verificada:**
```
grep -r "AuthModule" src/
→ CERO referencias (excepto en definición)
```

**✅ Impacto:** 
- ✓ Seguro eliminar
- ✓ No hay dependencias
- ✓ Proyecto compila sin errores

---

## CAMBIO 3: Eliminar archivo auth-routing-module.ts

**Archivo a eliminar:** `src/app/auth/auth-routing-module.ts`  
**Tamaño:** 10 líneas  
**Razón:** Vacío, solo importado por auth-module.ts (que también se elimina)

### 🔴 CONTENIDO ACTUAL (SERÁ ELIMINADO)
```typescript
import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [];

// @NgModule({
//   imports: [RouterModule.forChild(routes)],
//   exports: [RouterModule]
// })
export class AuthRoutingModule { }
```

**🔍 Búsqueda verificada:**
```
grep -r "AuthRoutingModule" src/
→ Solo en auth-module.ts (que se elimina)
```

**✅ Impacto:** 
- ✓ Seguro eliminar
- ✓ No hay dependencias
- ✓ Proyecto compila sin errores

---

## CAMBIO 4: Eliminar métodos muertos en firestore.ts

**Archivo:** `src/app/firebase/firestore.ts`  
**Líneas:** 115-121  
**Razón:** Métodos no usados, proyecto usa `createId()` en su lugar

### 🔴 ANTES
```typescript
  createDocumentID(data: any, enlace: string, idDoc: string) {
    const document = doc(this.firestore, `${enlace}/${idDoc}`);
    return setDoc(document, data);
  }

  createIdDoc() { return uuidv4(); }
  createId(): string { return uuidv4(); }
```

### 🟢 DESPUÉS
```typescript
  createId(): string { return uuidv4(); }
```

**🔍 Búsqueda verificada:**
```
grep -r "createDocumentID\|createIdDoc" src/
→ CERO referencias
```

**✅ Impacto:** 
- ✓ `createId()` sigue disponible
- ✓ No hay referencias a métodos eliminados
- ✓ Proyecto compila sin errores

---

## CAMBIO 5: Limpiar código comentado en auth-module.ts

**Alternativa:** En lugar de eliminar auth-module.ts, limpiar primero:

```typescript
// ANTES
// @NgModule({...comentarios...})
export class AuthModule { }

// DESPUÉS
export class AuthModule { }
```

**Nota:** Si autoriza ELIMINAR el archivo (Cambio 2), este paso NO es necesario.

---

# FASE B - GOOGLE MAPS

## CAMBIO 6: Remover Leaflet de angular.json

**Archivo:** `angular.json`  
**Línea:** 38  
**Razón:** Migrando a Google Maps

### 🔴 ANTES
```json
"styles": [
  "src/global.scss",
  "src/theme/variables.scss",
  "node_modules/leaflet/dist/leaflet.css"
]
```

### 🟢 DESPUÉS
```json
"styles": [
  "src/global.scss",
  "src/theme/variables.scss"
]
```

**✅ Impacto:** 
- ✓ Leaflet CSS no se carga
- ✓ Angular.json válido
- ✓ ~50KB menos en bundle

---

## CAMBIO 7: Crear google-maps.service.ts

**Archivo a crear:** `src/app/services/google-maps.service.ts`  
**Tamaño:** ~300 líneas  
**Propósito:** Centralizar lógica de Google Maps

### 🟢 CONTENIDO (NUEVO)
```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from 'src/environments/environment';

export interface PlacesSearchResult {
  lat: number;
  lng: number;
  title: string;
  address: string;
  placeId: string;
  tipo: 'veterinary_care' | 'pet_store';
  phone?: string;
  website?: string;
  openingHours?: string;
  isOpen?: boolean | null;
  rating?: number;
}

@Injectable({ providedIn: 'root' })
export class GoogleMapsService {
  private readonly http = inject(HttpClient);
  private map!: google.maps.Map;
  private mapsLoaded = false;

  // Inicializar Google Maps
  async initMap(elementId: string, center: { lat: number; lng: number }, zoom: number) {
    await this.loadGoogleMaps();
    this.map = new google.maps.Map(document.getElementById(elementId)!, {
      center,
      zoom,
      mapTypeId: google.maps.MapTypeId.ROADMAP,
    });
    return this.map;
  }

  // Cargar biblioteca de Google Maps
  private loadGoogleMaps(): Promise<void> {
    return new Promise((resolve) => {
      if (this.mapsLoaded || (window as any).google?.maps) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googleMapsApiKey}&libraries=places`;
      script.onload = () => {
        this.mapsLoaded = true;
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  // Buscar lugares cercanos
  async searchNearby(
    center: { lat: number; lng: number },
    type: 'veterinary_care' | 'pet_store',
    radius = 5000
  ): Promise<PlacesSearchResult[]> {
    await this.loadGoogleMaps();

    return new Promise((resolve, reject) => {
      const service = new google.maps.places.PlacesService(this.map);
      const request = {
        location: new google.maps.LatLng(center.lat, center.lng),
        radius,
        type,
      };

      service.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const lugares = results.map((result) => ({
            lat: result.geometry?.location?.lat() ?? 0,
            lng: result.geometry?.location?.lng() ?? 0,
            title: result.name ?? 'Sin nombre',
            address: result.vicinity ?? 'Dirección desconocida',
            placeId: result.place_id ?? '',
            tipo: type,
            phone: undefined,
            website: undefined,
            openingHours: undefined,
            isOpen: result.opening_hours?.open_now ?? null,
            rating: result.rating,
          } as PlacesSearchResult));
          resolve(lugares);
        } else {
          reject(new Error(`Places API error: ${status}`));
        }
      });
    });
  }

  // Agregar marcador
  addMarker(
    lat: number,
    lng: number,
    title: string,
    color: string = '#dc2626'
  ): google.maps.Marker {
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map: this.map,
      title,
      icon: this.createMarkerIcon(color),
    });
    return marker;
  }

  // Crear icono personalizado
  private createMarkerIcon(color: string): string {
    return `https://chart.googleapis.com/chart?chst=d_map_spin&chld=0.5|0|${color.replace(
      '#',
      ''
    )}|40|_|%E2%80%A2`;
  }

  // Obtener instancia del mapa
  getMap(): google.maps.Map {
    return this.map;
  }

  // Centrar mapa
  setCenter(lat: number, lng: number, zoom?: number) {
    this.map.setCenter({ lat, lng });
    if (zoom) this.map.setZoom(zoom);
  }
}
```

**✅ Impacto:** 
- ✓ Nuevo servicio centralizado
- ✓ No reemplaza nada existente
- ✓ Home component puede usarlo

---

## CAMBIO 8: Reescribir home.component.ts

**Archivo:** `src/app/home/home.component.ts`  
**Líneas:** 1-450 (prácticamente TODO)  
**Razón:** Migrar de Leaflet a Google Maps

### 🔴 CAMBIOS PRINCIPALES

**REMOVER:**
```typescript
// L30
declare const L: any;

// L87 (EnvironmentInjector no necesario)
private injector = inject(EnvironmentInjector);

// L107-110 (Overpass servers)
private readonly OVERPASS_SERVERS = [...]

// L143-152 (cargarLeaflet)
private cargarLeaflet(): Promise<void> { ... }

// L154-165 (initMap Leaflet)
private initMap() { ... }

// L143-430 (Toda lógica Leaflet)
```

**AGREGAR:**
```typescript
// Nueva inyección
private googleMaps = inject(GoogleMapsService);

// Nueva propiedad
map!: google.maps.Map;

// Método init Google Maps
private async initGoogleMap() {
  try {
    this.map = await this.googleMaps.initMap('google-map', 
      { lat: -33.4378, lng: -70.6504 }, 
      13
    );
  } catch (error) {
    this.presentToast('Error al cargar el mapa', 'danger');
  }
}

// Búsqueda reescrita para Google Places API
async findPlacesAction(tipo: 'veterinary_care' | 'pet_store') {
  this.currentSearchType = tipo;
  this.estaCargando = true;
  
  try {
    const lugares = await this.googleMaps.searchNearby(
      this.userPositionMarker || { lat: -33.4378, lng: -70.6504 },
      tipo
    );
    
    this.marcadoresEnMapa = lugares;
    this.renderMarkers();
  } catch (error) {
    this.presentToast('No se encontraron lugares', 'warning');
  } finally {
    this.estaCargando = false;
  }
}
```

**✅ Impacto:** 
- ✓ Mucho más rápido (Google API vs Overpass)
- ✓ Más confiable
- ✓ Mejor experiencia de usuario
- ⚠️ REQUIERE API KEY configurada

---

## CAMBIO 9: Actualizar home.component.html

**Archivo:** `src/app/home/home.component.html`  
**Línea:** ~84

### 🔴 ANTES
```html
<!-- MAPA LEAFLET -->
<ion-card-content>
  <div class="map-container">
    <google-map
      height="500px"
      width="100%"
      [center]="center"
      [zoom]="14">
    </google-map>
  </div>
</ion-card-content>
```

### 🟢 DESPUÉS
```html
<!-- MAPA GOOGLE MAPS -->
<ion-card-content>
  <div id="google-map" class="map-container" style="height: 500px; width: 100%;"></div>
</ion-card-content>
```

**✅ Impacto:** 
- ✓ Simpler HTML
- ✓ Mapa se renderiza correctamente
- ✓ Estilos CSS existentes funcionan

---

## CAMBIO 10: Actualizar environment.ts

**Archivo:** `src/environments/environment.ts`  
**Acción:** Agregar configuración Google Maps

### 🔴 ANTES
```typescript
export const environment = {
  production: false,
  firebase: { ... },
  aiProxyUrl: "/api/ai-proxy",
  appCheckSiteKey: "...",
  // ... resto
};
```

### 🟢 DESPUÉS
```typescript
export const environment = {
  production: false,
  firebase: { ... },
  aiProxyUrl: "/api/ai-proxy",
  appCheckSiteKey: "...",
  googleMapsApiKey: 'YOUR_GOOGLE_MAPS_API_KEY_HERE', // ⚠️ REQUIERE CONFIGURACIÓN
  // ... resto
};
```

**⚠️ REQUIERE ACCIÓN MANUAL:**
- [ ] Obtener API key de Google Maps Console
- [ ] Reemplazar `'YOUR_GOOGLE_MAPS_API_KEY_HERE'`
- [ ] Habilitar APIs: Maps JavaScript, Places API, Geocoding API

---

---

# 📋 RESUMEN DE CAMBIOS

## FASE A (Limpieza Segura)
| # | Cambio | Tipo | Riesgo | Dependencias |
|---|--------|------|--------|--------------|
| 1.1 | Eliminar ruta duplicada | Modificación | 🟢 BAJO | 0 |
| 2 | Eliminar auth-module.ts | Eliminación | 🟢 BAJO | 0 |
| 3 | Eliminar auth-routing-module.ts | Eliminación | 🟢 BAJO | 0 |
| 4 | Eliminar métodos muertos | Modificación | 🟢 BAJO | 0 |

**Duración:** 15 minutos  
**Riesgo total:** 🟢 MUY BAJO  
**Rollback:** Fácil con Git

---

## FASE B (Google Maps)
| # | Cambio | Tipo | Riesgo | Dependencias |
|---|--------|------|--------|--------------|
| 6 | Remover Leaflet | Modificación | 🟢 BAJO | 0 |
| 7 | Crear google-maps.service | Creación | 🟢 BAJO | google-maps API |
| 8 | Reescribir home.component.ts | Reescritura | 🟡 MEDIO | google-maps API |
| 9 | Actualizar home.component.html | Modificación | 🟢 BAJO | 0 |
| 10 | Agregar environment config | Modificación | 🟢 BAJO | 0 |

**Duración:** 4-5 horas  
**Riesgo total:** 🟡 MEDIO  
**Rollback:** Manual

---

# ✅ VERIFICACIONES AUTOMÁTICAS

Después de aplicar cambios, ejecutaré:

```bash
✓ npm run build
✓ ng lint
✓ Buscar referencias a código eliminado
✓ Verificar imports correctos
✓ Testing navegación
```

---

# ⚠️ CAMBIOS NO INCLUIDOS (Requieren revisión manual)

## Firestore Rules
**Archivo:** `firestore.rules`  
**Estado:** Preparado para revisión  
**Acción requerida:** Usuario revisa antes de desplegar

→ [Ver PREPARACIÓN en siguiente documento]

## Storage Rules
**Archivo:** `storage.rules`  
**Estado:** Verificado, sin cambios  
**Acción requerida:** Usuario confirma

## Eliminación de carpetas
**Carpeta:** `src/app/mascota-detalle/`  
**Estado:** Identificada pero NO se eliminará sin confirmación  
**Acción requerida:** Usuario autoriza explícitamente

---

# 🎯 ¿QUÉ NECESITO DE TI?

**Confirmar lo siguiente, línea por línea:**

1. ✅/❌ **CAMBIO 1.1:** Eliminar ruta `carnet-mascota` duplicada
   ```
   Línea 86-90 en app.routes.ts
   ```

2. ✅/❌ **CAMBIO 2:** Eliminar archivo `src/app/auth/auth-module.ts`
   ```
   24 líneas, completamente comentado
   ```

3. ✅/❌ **CAMBIO 3:** Eliminar archivo `src/app/auth/auth-routing-module.ts`
   ```
   10 líneas, vacío
   ```

4. ✅/❌ **CAMBIO 4:** Eliminar métodos `createDocumentID()` y `createIdDoc()`
   ```
   Líneas 115-121 en firestore.ts
   ```

5. ✅/❌ **CAMBIO 6:** Remover Leaflet CSS de angular.json

6. ✅/❌ **CAMBIO 7:** Crear nuevo `google-maps.service.ts`

7. ✅/❌ **CAMBIO 8:** Reescribir `home.component.ts`
   ```
   ⚠️ Cambio grande - revisar cuidadosamente
   ```

8. ✅/❌ **CAMBIO 9:** Actualizar `home.component.html`

9. ✅/❌ **CAMBIO 10:** Agregar config Google Maps a `environment.ts`

---

**Una vez reciba confirmación, aplicaré todos los cambios.**

**¿Alguna pregunta sobre los cambios propuestos antes de confirmar?**
