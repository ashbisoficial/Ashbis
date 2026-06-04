import {
  Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA,
  EnvironmentInjector, runInInjectionContext
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner,
  IonInput, IonItem, IonLabel, IonTextarea
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { map } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { addIcons } from 'ionicons';
import {
  hourglassOutline, locateOutline, star, bagOutline, pawOutline,
  chatbubblesOutline, heartOutline, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline
} from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { FirestoreService } from '../firebase/firestore';
import { firstValueFrom } from 'rxjs';
import { User } from '@angular/fire/auth';

register();
declare const L: any;

interface Marcador {
  lat: number;
  lng: number;
  title: string;
  address: string;
  rating?: number;
  placeId?: string;
  tipo: 'veterinary_care' | 'pet_store';
  phone?: string;
  website?: string;
  openingHours?: string;
  isOpen?: boolean | null;
  userInfo?: LugarUserInfo;
}

interface LugarUserInfo {
  phone?: string;
  website?: string;
  openingHours?: string;
  descripcion?: string;
  rating?: number;
}

type VeterinariaFavoritaInput = {
  placeId: string;
  nombre: string;
  direccion: string;
  lat: number;
  lng: number;
  rating?: number;
  tipos?: string[];
};

addIcons({
  hourglassOutline, locateOutline, bagOutline, pawOutline, star,
  chatbubblesOutline, heartOutline, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline
});

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonButton, IonIcon, IonCardContent, IonContent, IonSpinner,
    IonInput, IonItem, IonLabel, IonTextarea
  ],
  providers: [ToastController],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage implements OnInit, OnDestroy {

  private auth            = inject(AuthenticationService);
  private router          = inject(Router);
  private toastController = inject(ToastController);
  private firestoreService= inject(FirestoreService);
  private injector        = inject(EnvironmentInjector);

  userEmail$ = this.auth.authState$.pipe(map(u => u?.email ?? ''));

  // Estado general
  estaCargando = false;
  marcadoresEnMapa: Marcador[] = [];
  marcadorSeleccionado: Marcador | undefined;
  mostrarPanel = false;
  modoEdicion  = false;
  currentSearchType: 'veterinary_care' | 'pet_store' | null = null;
  editForm: LugarUserInfo = {};

  // Leaflet internals
  private map: any;
  private markersLayer: any;
  private userMarker: any;
  userPositionMarker: { lat: number; lng: number } | undefined;

  // Servidores Overpass en orden de prioridad
  private readonly OVERPASS_SERVERS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];

  imagenesCarrusel = [
    { src: 'assets/img/carrusel1.jpg', titulo: 'Cuidado y amor para tus mascotas' },
    { src: 'assets/img/carrusel2.jpg', titulo: 'Productos y accesorios' },
    { src: 'assets/img/carrusel3.jpg', titulo: 'Adopta y cambia una vida' },
  ];

  imagenesCarruselInferior = [
    { src: 'assets/img/9.jpg',  titulo: 'Evento 1' },
    { src: 'assets/img/12.jpg', titulo: 'Evento 2' },
    { src: 'assets/img/11.jpg', titulo: 'Evento 3' },
    { src: 'assets/img/10.jpg', titulo: 'Evento 4' },
  ];

  constructor(private toastCtrl: ToastController) {
    addIcons({ chatbubblesOutline, locateOutline, bagOutline });
  }

  // ── Lifecycle ────────────────────────────────────────
  ngOnInit() {
    this.cargarLeaflet().then(() => this.initMap());
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    delete (window as any).ashbisSeleccionarMarcador;
  }

  // Leaflet is already loaded from angular.json styles and node_modules
  private cargarLeaflet(): Promise<void> {
    return Promise.resolve();
  }

  private initMap() {
    setTimeout(() => {
      if (this.map) return;
      this.map = L.map('leaflet-map', {
        center: [-33.4378, -70.6504],
        zoom: 13,
        zoomControl: true,
      });

      // ── Estilo del mapa: Carto Dark ──
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(this.map);

      this.markersLayer = L.layerGroup().addTo(this.map);
    }, 300);
  }

  // ── Toast ────────────────────────────────────────────
  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message, duration: 3000, position: 'bottom', color,
    });
    await toast.present();
  }

  // ── Horario OSM ──────────────────────────────────────
  private evaluarHorario(openingHours: string | undefined): boolean | null {
    if (!openingHours) return null;
    const oh = openingHours.trim().toLowerCase();
    if (oh === '24/7') return true;

    const now      = new Date();
    const dayIndex = now.getDay();
    const hora     = now.getHours() * 60 + now.getMinutes();

    const diasMap: Record<string, number[]> = {
      mo: [1], tu: [2], we: [3], th: [4], fr: [5], sa: [6], su: [0],
      'mo-fr': [1,2,3,4,5], 'mo-sa': [1,2,3,4,5,6],
      'mo-su': [0,1,2,3,4,5,6], 'sa-su': [0,6],
    };

    for (const parte of oh.split(';').map(p => p.trim())) {
      const match = parte.match(/^([a-z\-]+)\s+(\d{2}):(\d{2})-(\d{2}):(\d{2})$/);
      if (!match) continue;
      const [, dia, h1, m1, h2, m2] = match;
      const diasValidos = diasMap[dia];
      if (!diasValidos?.includes(dayIndex)) continue;
      const inicio = +h1 * 60 + +m1;
      const fin    = +h2 * 60 + +m2;
      return hora >= inicio && hora <= fin;
    }
    return null;
  }

  // ── Búsqueda ─────────────────────────────────────────
  findPlacesAction(tipo: 'veterinary_care' | 'pet_store') {
    this.currentSearchType = tipo;
    this.marcadoresEnMapa  = [];
    this.marcadorSeleccionado = undefined;
    this.mostrarPanel = false;
    this.markersLayer?.clearLayers();

    if (this.userPositionMarker) {
      this.searchNearbyPlaces(this.userPositionMarker);
    } else {
      this.getCurrentLocation();
    }
  }

  getCurrentLocation() {
    if (!navigator.geolocation) {
      this.presentToast('Geolocalización no disponible.', 'danger');
      return;
    }
    this.estaCargando = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userPositionMarker = coords;
        this.map.setView([coords.lat, coords.lng], 14);
        if (this.userMarker) this.userMarker.remove();
        this.userMarker = L.circleMarker([coords.lat, coords.lng], {
          radius: 10, fillColor: '#2563eb', color: '#fff', weight: 2, fillOpacity: 0.9,
        }).addTo(this.map).bindPopup('Tu ubicación').openPopup();
        if (this.currentSearchType) {
          this.searchNearbyPlaces(coords);
        } else {
          this.estaCargando = false;
        }
      },
      () => {
        this.estaCargando = false;
        this.presentToast('No se pudo obtener tu ubicación. Activa el GPS.', 'danger');
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }

  searchNearbyPlaces(coords: { lat: number; lng: number }) {
    this.estaCargando = true;
    this.markersLayer?.clearLayers();

    const tag = this.currentSearchType === 'veterinary_care' ? 'amenity=veterinary' : 'shop=pet';
    const query = `
      [out:json][timeout:25];
      (
        node[${tag}](around:5000,${coords.lat},${coords.lng});
        way[${tag}](around:5000,${coords.lat},${coords.lng});
      );
      out center tags;
    `;
    this.intentarOverpass(0, query);
  }

  private intentarOverpass(index: number, query: string) {
    if (index >= this.OVERPASS_SERVERS.length) {
      this.estaCargando = false;
      this.presentToast('No se pudo conectar al servidor. Intenta en unos minutos.', 'danger');
      return;
    }

    fetch(this.OVERPASS_SERVERS[index], { method: 'POST', body: query })
      .then(r => {
        const ct = r.headers.get('content-type') || '';
        if (!r.ok || ct.includes('xml') || ct.includes('text/html')) {
          throw new Error(`Error ${r.status} en servidor ${index + 1}`);
        }
        return r.json();
      })
      .then(data => this.procesarResultados(data.elements || []))
      .catch(err => {
        console.warn(`Servidor ${index + 1} falló:`, err.message);
        setTimeout(() => this.intentarOverpass(index + 1, query), 500);
      });
  }

  private async procesarResultados(elementos: any[]) {
    this.estaCargando = false;

    if (!elementos.length) {
      this.presentToast('No se encontraron lugares en 5 km.', 'warning');
      return;
    }

    const colorAbierto     = this.currentSearchType === 'veterinary_care' ? '#dc2626' : '#16a34a';
    const colorCerrado     = '#6b7280';
    const colorDesconocido = this.currentSearchType === 'veterinary_care' ? '#fca5a5' : '#86efac';

    // Una sola llamada a Firestore para todos los lugares
    const infoExtra = await runInInjectionContext(this.injector, () =>
      this.firestoreService.getLugaresInfo(elementos.map(e => String(e.id)))
    );

    this.marcadoresEnMapa = elementos
      .filter(el => (el.lat ?? el.center?.lat) && (el.lon ?? el.center?.lon))
      .map(el => ({
        lat:          el.lat ?? el.center?.lat,
        lng:          el.lon ?? el.center?.lon,
        title:        el.tags?.name || (this.currentSearchType === 'veterinary_care' ? 'Veterinaria' : 'Tienda de mascotas'),
        address:      el.tags?.['addr:street']
                        ? `${el.tags['addr:street']} ${el.tags['addr:housenumber'] || ''}`.trim()
                        : 'Dirección no disponible',
        placeId:      String(el.id),
        tipo:         this.currentSearchType!,
        phone:        el.tags?.phone || el.tags?.['contact:phone'],
        website:      el.tags?.website || el.tags?.['contact:website'],
        openingHours: el.tags?.opening_hours,
        isOpen:       this.evaluarHorario(el.tags?.opening_hours),
        userInfo:     infoExtra[String(el.id)],
      }));

    this.marcadoresEnMapa.forEach(m => {
      const fillColor  = m.isOpen === true ? colorAbierto : m.isOpen === false ? colorCerrado : colorDesconocido;
      const marker = L.circleMarker([m.lat, m.lng], {
        radius:      m.isOpen === true ? 10 : 8,
        fillColor,
        color:       '#fff',
        weight:      2,
        fillOpacity: m.isOpen === false ? 0.45 : 0.9,
      }).addTo(this.markersLayer);

      marker.on('click', () => this.seleccionarMarcador(m));
    });

    const abiertos = this.marcadoresEnMapa.filter(m => m.isOpen === true).length;
    const sinInfo  = this.marcadoresEnMapa.filter(m => m.isOpen === null).length;
    this.presentToast(
      `${this.marcadoresEnMapa.length} lugares · ${abiertos} abiertos · ${sinInfo} sin horario`,
      'success'
    );
  }

  // ── Panel de info ────────────────────────────────────
  seleccionarMarcador(m: Marcador) {
    this.marcadorSeleccionado = m;
    this.modoEdicion = false;
    this.editForm    = { ...m.userInfo };
    this.mostrarPanel = true;
    setTimeout(() => {
      document.getElementById('panel-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  cerrarPanel() {
    this.mostrarPanel = false;
    this.marcadorSeleccionado = undefined;
    this.modoEdicion = false;
  }

  activarEdicion() {
    this.modoEdicion = true;
    if (this.marcadorSeleccionado) {
      this.editForm = {
        phone:        this.marcadorSeleccionado.phone,
        website:      this.marcadorSeleccionado.website,
        openingHours: this.marcadorSeleccionado.openingHours,
        ...this.marcadorSeleccionado.userInfo,
      };
    }
  }

  async guardarInfoUsuario() {
    if (!this.marcadorSeleccionado?.placeId) return;
    const user = await firstValueFrom(this.auth.authState$) as User | null;
    if (!user) { this.presentToast('Debes iniciar sesión para editar.', 'warning'); return; }

    try {
      await runInInjectionContext(this.injector, () =>
        this.firestoreService.saveLugarInfo(
          this.marcadorSeleccionado!.placeId!,
          { ...this.editForm, actualizadoPor: user.uid }
        )
      );
      this.marcadorSeleccionado.userInfo = { ...this.editForm };
      this.modoEdicion = false;
      this.presentToast('Información guardada correctamente.', 'success');
    } catch {
      this.presentToast('Error al guardar. Intenta de nuevo.', 'danger');
    }
  }

  async guardarVeterinariaFavorita() {
    if (!this.marcadorSeleccionado) return;
    if (this.currentSearchType !== 'veterinary_care') {
      this.presentToast('Solo puedes guardar veterinarias como favoritas.', 'warning');
      return;
    }
    const user = await firstValueFrom(this.auth.authState$) as User | null;
    if (!user) { this.presentToast('Debes iniciar sesión para guardar favoritos.', 'warning'); return; }

    const m = this.marcadorSeleccionado;
    const vet: VeterinariaFavoritaInput = {
      placeId:  m.placeId || '',
      nombre:   m.title,
      direccion: m.address,
      lat:      m.lat,
      lng:      m.lng,
      rating:   m.rating,
      tipos:    [],
    };
    await this.firestoreService.addVeterinariaFavorita(user.uid, vet);
    this.presentToast('Veterinaria añadida a favoritos', 'success');
  }

  // ── Helpers ──────────────────────────────────────────
  getEstadoLabel(m: Marcador): string {
    if (m.isOpen === true)  return 'Abierto ahora';
    if (m.isOpen === false) return 'Cerrado ahora';
    return 'Horario desconocido';
  }

  getEstadoColor(m: Marcador): string {
    if (m.isOpen === true)  return 'success';
    if (m.isOpen === false) return 'danger';
    return 'medium';
  }

  irAlChatIA() {
    this.router.navigate(['/chat-ia']);
  }
}