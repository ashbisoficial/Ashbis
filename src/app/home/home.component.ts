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
import { map, switchMap } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { addIcons } from 'ionicons';
import {
  hourglassOutline, locateOutline, star, bagOutline, pawOutline,
  chatbubblesOutline, heartOutline, heart, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline,
  chevronBackOutline, chevronForwardOutline, paw, bag
} from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { FirestoreService, VeterinariaFavorita } from '../firebase/firestore';
import { firstValueFrom, of, Subject, takeUntil } from 'rxjs';
import { User } from '@angular/fire/auth';
import * as L from 'leaflet';
register();


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
  distanciaM?: number;
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
  chatbubblesOutline, heartOutline, heart, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline,
  chevronBackOutline, chevronForwardOutline, paw, bag
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
  private markerRefs = new Map<string, L.Marker>();
  userPositionMarker: { lat: number; lng: number } | undefined;

  // Favoritos
  private destroy$ = new Subject<void>();
  veterinariasFavoritas: VeterinariaFavorita[] = [];

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
    this.cargarVeterinariasFavoritas();
  }

  ngOnDestroy() {
    if (this.map) { this.map.remove(); this.map = null; }
    this.markerRefs.clear();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    delete (window as any).ashbisSeleccionarMarcador;
    this.destroy$.next();
    this.destroy$.complete();
  }

  private cargarVeterinariasFavoritas() {
    this.auth.authState$.pipe(
      takeUntil(this.destroy$),
      switchMap(user => {
        if (!user) return of<VeterinariaFavorita[]>([]);
        return runInInjectionContext(this.injector, () =>
          this.firestoreService.getVeterinariasFavoritasByUsuario(user.uid)
        );
      })
    ).subscribe(vets => {
      this.veterinariasFavoritas = vets;
    });
  }

  /** Devuelve true si la veterinaria (por placeId) ya está en favoritos del usuario */
  esFavorita(placeId?: string): boolean {
    if (!placeId) return false;
    return this.veterinariasFavoritas.some(v => v.placeId === placeId);
  }

  private buscarFavoritaPorPlaceId(placeId?: string): VeterinariaFavorita | undefined {
    if (!placeId) return undefined;
    return this.veterinariasFavoritas.find(v => v.placeId === placeId);
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
    this.markerRefs.clear();

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

    // Ordenamos por cercanía real para que "Siguiente / Anterior" tenga sentido
    if (this.userPositionMarker) {
      const { lat: ulat, lng: ulng } = this.userPositionMarker;
      this.marcadoresEnMapa.forEach(m => {
        m.distanciaM = this.distanciaMetros(ulat, ulng, m.lat, m.lng);
      });
      this.marcadoresEnMapa.sort((a, b) => (a.distanciaM ?? Infinity) - (b.distanciaM ?? Infinity));
    }

    this.markerRefs.clear();
    this.marcadoresEnMapa.forEach(m => {
      const marker = L.marker([m.lat, m.lng], { icon: this.crearIcono(m.tipo, m.isOpen) })
        .addTo(this.markersLayer);
      marker.on('click', () => this.seleccionarMarcador(m));
      if (m.placeId) this.markerRefs.set(m.placeId, marker);
    });

    const abiertos = this.marcadoresEnMapa.filter(m => m.isOpen === true).length;
    const sinInfo  = this.marcadoresEnMapa.filter(m => m.isOpen === null).length;
    this.presentToast(
      `${this.marcadoresEnMapa.length} lugares · ${abiertos} abiertos · ${sinInfo} sin horario`,
      'success'
    );
  }

  // ── Panel de info ────────────────────────────────────
  seleccionarMarcador(m: Marcador, centrarMapa = false) {
    this.marcadorSeleccionado = m;
    this.modoEdicion = false;
    this.editForm    = { ...m.userInfo };
    this.mostrarPanel = true;
    this.resaltarMarcadorEnMapa(m.placeId);

    if (centrarMapa && this.map) {
      this.map.flyTo([m.lat, m.lng], Math.max(this.map.getZoom(), 15), { duration: 0.5 });
    }

    setTimeout(() => {
      document.getElementById('panel-info')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  // ── Navegación entre resultados con flechas ───────────
  get indiceMarcadorActual(): number {
    if (!this.marcadorSeleccionado) return 0;
    return this.marcadoresEnMapa.findIndex(m => m.placeId === this.marcadorSeleccionado!.placeId) + 1;
  }

  irMarcadorAnterior() { this.navegarMarcador(-1); }
  irMarcadorSiguiente() { this.navegarMarcador(1); }

  private navegarMarcador(delta: number) {
    const total = this.marcadoresEnMapa.length;
    if (!total) return;
    const actual = this.marcadorSeleccionado
      ? this.marcadoresEnMapa.findIndex(m => m.placeId === this.marcadorSeleccionado!.placeId)
      : -1;
    const siguiente = ((actual === -1 ? 0 : actual) + delta + total) % total;
    this.seleccionarMarcador(this.marcadoresEnMapa[siguiente], true);
  }

  private resaltarMarcadorEnMapa(placeId?: string) {
    this.markerRefs.forEach((marker, id) => {
      const pin = marker.getElement()?.querySelector('.marker-badge');
      pin?.classList.toggle('marker-badge--selected', id === placeId);
    });
  }

  formatearDistancia(m?: number): string {
    if (m == null) return '';
    return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
  }

  private distanciaMetros(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // ── Icono personalizado del marcador ──────────────────
  private crearIcono(tipo: 'veterinary_care' | 'pet_store', isOpen: boolean | null | undefined): L.DivIcon {
    const colorAbierto     = tipo === 'veterinary_care' ? '#dc2626' : '#16a34a';
    const colorCerrado     = '#6b7280';
    const colorDesconocido = tipo === 'veterinary_care' ? '#fca5a5' : '#86efac';
    const color  = isOpen === true ? colorAbierto : isOpen === false ? colorCerrado : colorDesconocido;
    const tamano = isOpen === true ? 38 : 32;
    const nombreIcono = tipo === 'veterinary_care' ? 'paw' : 'bag';

    return L.divIcon({
      className: 'marker-divicon-wrapper',
      html: `<div class="marker-badge" style="width:${tamano}px;height:${tamano}px;background:${color};">
               <ion-icon name="${nombreIcono}"></ion-icon>
             </div>`,
      iconSize: [tamano, tamano],
      iconAnchor: [tamano / 2, tamano / 2],
    });
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
    const yaEsFavorita = this.buscarFavoritaPorPlaceId(m.placeId);

    if (yaEsFavorita) {
      // Ya está en favoritos → la quitamos
      await runInInjectionContext(this.injector, () =>
        this.firestoreService.deleteVeterinariaFavorita(user.uid, yaEsFavorita.id!)
      );
      this.veterinariasFavoritas = this.veterinariasFavoritas.filter(v => v.id !== yaEsFavorita.id);
      this.presentToast('Veterinaria quitada de favoritos', 'success');
      return;
    }

    const vet: VeterinariaFavoritaInput = {
      placeId:  m.placeId || '',
      nombre:   m.title,
      direccion: m.address,
      lat:      m.lat,
      lng:      m.lng,
      rating:   m.rating,
      tipos:    [],
    };
    const docRef = await runInInjectionContext(this.injector, () =>
      this.firestoreService.addVeterinariaFavorita(user.uid, vet)
    );
    this.presentToast('Veterinaria añadida a favoritos', 'success');
    // Actualizamos el estado local para que el corazón se rellene de inmediato
    this.veterinariasFavoritas = [
      ...this.veterinariasFavoritas,
      { ...vet, id: docRef?.id, uidUsuario: user.uid }
    ];
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