import {
  Component, inject, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA,
  EnvironmentInjector, runInInjectionContext
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonCard, IonButton, IonButtons, IonIcon, IonCardContent, IonContent, IonSpinner,
  IonInput, IonItem, IonLabel, IonTextarea
} from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { map, switchMap, take } from 'rxjs/operators';
import { AuthenticationService } from 'src/app/firebase/authentication';
import { addIcons } from 'ionicons';
import {
  hourglassOutline, locateOutline, star, bagOutline, pawOutline,
  chatbubblesOutline, heartOutline, heart, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline,
  chevronBackOutline, chevronForwardOutline, paw, bag,
  qrCodeOutline, addCircleOutline, navigateOutline, expandOutline, contractOutline,
  informationCircleOutline
} from 'ionicons/icons';
import { register } from 'swiper/element/bundle';
import { FirestoreService, VeterinariaFavorita } from '../firebase/firestore';
import { Models } from '../models/models';
import { NotificacionesBellComponent } from '../notificaciones/notificaciones-bell.component';
import { RefugioContextService } from '../services/refugio-context.service';
import { PreferenciasService } from '../services/preferencias.service';
import { ChatUnreadService } from '../services/chat-unread.service';
import { firstValueFrom, of, Subject, takeUntil } from 'rxjs';
import { User } from '@angular/fire/auth';
import { environment } from 'src/environments/environment';
register();

// El script de Google Maps JavaScript API (cargado dinámicamente en
// cargarGoogleMaps()) define este objeto global; no hay tipos oficiales
// livianos para la librería "places" nueva, así que lo tratamos como `any`.
declare const google: any;


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

/** Estilo oscuro del mapa (antes era el tile claro "Voyager" de Carto/
 *  Leaflet) — coherente con el tema único oscuro del resto de la app. */
const GOOGLE_MAP_DARK_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a1a1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3d3d3d' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

addIcons({
  hourglassOutline, locateOutline, bagOutline, pawOutline, star,
  chatbubblesOutline, heartOutline, heart, closeOutline, createOutline,
  callOutline, globeOutline, timeOutline, starOutline,
  chevronBackOutline, chevronForwardOutline, paw, bag,
  qrCodeOutline, addCircleOutline, navigateOutline, expandOutline, contractOutline,
  informationCircleOutline
});

@Component({
  selector: 'app-home',
  templateUrl: 'home.component.html',
  styleUrls: ['home.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonCard, IonButton, IonButtons, IonIcon, IonCardContent, IonContent, IonSpinner,
    IonInput, IonItem, IonLabel, IonTextarea,
    NotificacionesBellComponent
  ],
  providers: [ToastController],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class HomePage implements OnInit, OnDestroy {

  private auth            = inject(AuthenticationService);
  private router          = inject(Router);
  private toastController = inject(ToastController);
  private firestoreService= inject(FirestoreService);
  private refugioCtx      = inject(RefugioContextService);
  private preferencias    = inject(PreferenciasService);
  private chatUnread      = inject(ChatUnreadService);
  private injector        = inject(EnvironmentInjector);

  /** Refugios a los que tengo acceso (dueño y/o colaborador); vacío = sin chat de equipo. */
  private misRefugios: string[] = [];
  /** Chats directos de adopción (como postulante o como refugio). */
  private misChatsDirectos: Models.ChatDirecto.Chat[] = [];

  userEmail$ = this.auth.authState$.pipe(map(u => u?.email ?? ''));
  /** Círculo rojo sobre el ícono de chat: hay algún mensaje sin leer. */
  tengoChatsNoLeidos$ = this.chatUnread.tengoNoLeidos$();

  // Estado general
  estaCargando = false;
  marcadoresEnMapa: Marcador[] = [];
  marcadorSeleccionado: Marcador | undefined;
  mostrarPanel = false;
  modoEdicion  = false;
  currentSearchType: 'veterinary_care' | 'pet_store' | null = null;
  editForm: LugarUserInfo = {};

  // Google Maps internals (google.maps.Map / Marker — sin tipos oficiales
  // livianos, se usan como `any` igual que el resto del archivo).
  private map: any;
  private userMarker: any;
  private markerRefs = new Map<string, any>();
  userPositionMarker: { lat: number; lng: number } | undefined;

  // El mapa arranca "bloqueado" (sin arrastre/zoom con rueda/pinch) para que
  // hacer scroll de la página cerca del mapa no lo termine moviendo por
  // accidente. Se desbloquea al expandirlo (botón o doble click/doble tap).
  mapaExpandido = false;

  // Favoritos
  private destroy$ = new Subject<void>();
  veterinariasFavoritas: VeterinariaFavorita[] = [];

  // Carga perezosa y única del script de Google Maps JavaScript API
  private googleMapsLoadPromise: Promise<void> | null = null;

  // Cache en memoria de resultados de Places API por zona (~100 m) y tipo,
  // para no repetir la misma consulta pagada dentro de la misma sesión.
  private cacheResultados = new Map<string, any[]>();

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

  // Feed público completo de publicaciones de refugios (adopción/
  // recolección/donación/otro), sin filtrar — de acá se derivan
  // publicacionesCarrusel y publicacionesAdopcion.
  publicacionesActivas: Models.Publicaciones.Publicacion[] = [];

  // Carrusel general: campañas/eventos (recolección, donación, otro), sin
  // las publicaciones de adopción de una mascota puntual. Si no hay
  // ninguna activa, el carrusel muestra las imágenes genéricas de
  // imagenesCarruselInferior en su lugar.
  publicacionesCarrusel: Models.Publicaciones.Publicacion[] = [];

  // Sección de tarjetas "Mascotas en adopción" (debajo del segundo
  // carrusel): solo publicaciones tipo 'adopcion'. La publicación misma
  // guarda su propia copia de la info pública de la mascota (foto, especie,
  // raza, sexo, edad...) — mascotas/{id} no es legible por cualquiera, así
  // que NO se puede hacer un lookup en vivo acá para nadie que no sea el
  // dueño/equipo (Cloud Function onMascotaActualizada mantiene esa copia al
  // día si el dueño edita la ficha después de publicar).
  publicacionesAdopcion: Models.Publicaciones.Publicacion[] = [];

  constructor() {
    addIcons({ chatbubblesOutline, locateOutline, bagOutline });
  }

  // ── Lifecycle ────────────────────────────────────────
  ngOnInit() {
    this.initMap();
    this.cargarVeterinariasFavoritas();
    this.cargarPublicacionesActivas();
    this.cargarContextoRefugio();
  }

  private cargarContextoRefugio(): void {
    runInInjectionContext(this.injector, () => this.refugioCtx.contexto$())
      .pipe(take(1), takeUntil(this.destroy$))
      .subscribe(ctx => {
        this.misRefugios = ctx.todos;
        if (!ctx.miUid) return;
        runInInjectionContext(this.injector, () =>
          this.firestoreService.getMisChatsDirectos(ctx.miUid!)
        ).pipe(take(1), takeUntil(this.destroy$))
          .subscribe(chats => { this.misChatsDirectos = chats; });
      });
  }

  /** Si hay más de un chat en total (equipos + directos) lleva al listado
   *  estilo WhatsApp; si hay uno solo, abre esa conversación directamente. */
  /** El ícono de chat está siempre visible, tenga o no chats: si no tiene
   *  ninguno todavía, "Mis chats" muestra un estado vacío que explica cómo
   *  se genera uno (postular a una adopción o sumarse a un equipo), en vez
   *  de que el botón no haga nada y nadie entienda para qué sirve. */
  irAMisChats(): void {
    const totalDirectos = this.misChatsDirectos.length;
    const total = this.misRefugios.length + totalDirectos;

    if (total > 1 || total === 0) {
      this.router.navigate(['/tabs/mis-chats']);
      return;
    }
    if (totalDirectos === 1) {
      this.router.navigate(['/tabs/chat-directo', this.misChatsDirectos[0].id]);
    } else {
      this.refugioCtx.irARefugio(this.misRefugios, '/tabs/refugio-chat');
    }
  }

  private cargarPublicacionesActivas() {
    runInInjectionContext(this.injector, () =>
      this.firestoreService.getPublicacionesActivas()
    ).pipe(takeUntil(this.destroy$))
      .subscribe(pubs => {
        this.publicacionesActivas = pubs;
        // El carrusel general es para campañas/eventos del refugio
        // (recolección, donación, otro) — las publicaciones de una
        // mascota puntual en adopción tienen su propia sección de
        // tarjetas más abajo, para no mostrarlas duplicadas.
        this.publicacionesCarrusel = pubs.filter(p => p.tipo !== 'adopcion');
        this.publicacionesAdopcion = pubs.filter(p => p.tipo === 'adopcion');
      });
  }

  /** Con muy pocos slides, loop="true" de Swiper queda roto/glitcheado
   *  (advertencia propia de la librería) — se desactiva el loop en vez de
   *  mostrar un carrusel visualmente partido. */
  get loopCarruselInferior(): boolean {
    return (this.publicacionesCarrusel.length || this.imagenesCarruselInferior.length) >= 4;
  }

  /** Foto/nombre/info principal para la tarjeta: la publicación ya trae su
   *  propia copia de la info pública de la mascota (ver nota en
   *  publicacionesAdopcion más arriba). */
  fotoAdopcion(pub: Models.Publicaciones.Publicacion): string {
    return pub.fotoUrl || 'assets/img/9.jpg';
  }

  nombreAdopcion(pub: Models.Publicaciones.Publicacion): string {
    return pub.titulo;
  }

  infoPrincipalAdopcion(pub: Models.Publicaciones.Publicacion): string {
    const info = [pub.especie, pub.raza, pub.edad != null ? `${pub.edad} años` : null]
      .filter(Boolean)
      .join(' · ');
    return info || pub.nombreAutor;
  }

  verPublicacion(pub: Models.Publicaciones.Publicacion): void {
    if (!pub.id) return;
    this.router.navigate(['/tabs/publicacion', pub.id]);
  }

  ngOnDestroy() {
    if (this.map) {
      google.maps.event.clearInstanceListeners(this.map);
      this.map = null;
    }
    this.markerRefs.forEach(m => m.setMap(null));
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

  /** Inicializa el mapa visual con la misma API de Google que ya se usaba
   *  para buscar veterinarias/tiendas (Places) — antes el buscador era de
   *  Google pero el mapa que se veía era Leaflet/OpenStreetMap, dos fuentes
   *  distintas mostrando la misma zona. */
  private async initMap(): Promise<void> {
    if (this.map) return;
    await this.cargarGoogleMaps();
    const { Map } = await google.maps.importLibrary('maps');
    const contenedor = document.getElementById('google-map');
    if (!contenedor) return;

    this.map = new Map(contenedor, {
      center: { lat: -33.4378, lng: -70.6504 },
      zoom: 13,
      disableDefaultUI: true,
      zoomControl: true,
      gestureHandling: 'none', // bloqueado hasta expandir (ver toggleExpandirMapa)
      // Estilo oscuro simple, coherente con el resto de la app (antes era
      // el tile "Voyager" de Carto, más claro).
      styles: GOOGLE_MAP_DARK_STYLE,
    });

    // Doble click/doble tap expande o colapsa el mapa.
    this.map.addListener('dblclick', () => this.toggleExpandirMapa());
  }

  /** Expande el mapa a pantalla completa (y habilita arrastre/zoom) o lo
   *  vuelve a su tamaño embebido (y los vuelve a bloquear). */
  toggleExpandirMapa(): void {
    this.mapaExpandido = !this.mapaExpandido;
    if (!this.map) return;

    this.map.setOptions({ gestureHandling: this.mapaExpandido ? 'greedy' : 'none' });

    // El contenedor cambia de tamaño con la clase .expandido (ver scss);
    // Google Maps necesita que se le avise para recalcular sus dimensiones
    // después de la transición.
    setTimeout(() => {
      if (!this.map) return;
      google.maps.event.trigger(this.map, 'resize');
      const centro = this.userPositionMarker ?? { lat: -33.4378, lng: -70.6504 };
      this.map.setCenter(centro);
    }, 320);
  }

  /** Centra el mapa en la ubicación del usuario. Si todavía no la tenemos
   *  (no se buscó nada aún), la pide igual que "Veterinaria"/"Tienda". */
  centrarEnUsuario(): void {
    if (this.userPositionMarker && this.map) {
      this.map.setCenter(this.userPositionMarker);
      this.map.setZoom(14);
    } else {
      this.getCurrentLocation();
    }
  }

  // ── Toast ────────────────────────────────────────────
  async presentToast(message: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastController.create({
      message, duration: 3000, position: 'bottom', color,
    });
    await toast.present();
  }

  /** Saca todos los marcadores de veterinarias/tiendas del mapa (no toca
   *  userMarker, que es aparte). */
  private limpiarMarcadores(): void {
    this.markerRefs.forEach(m => m.setMap(null));
    this.markerRefs.clear();
  }

  // ── Búsqueda ─────────────────────────────────────────
  findPlacesAction(tipo: 'veterinary_care' | 'pet_store') {
    this.currentSearchType = tipo;
    this.marcadoresEnMapa  = [];
    this.marcadorSeleccionado = undefined;
    this.mostrarPanel = false;
    this.limpiarMarcadores();

    if (this.userPositionMarker) {
      this.searchNearbyPlaces(this.userPositionMarker);
    } else {
      this.getCurrentLocation();
    }
  }

  getCurrentLocation() {
    if (!this.preferencias.ubicacionHabilitada) {
      this.presentToast('Activá la ubicación en Configuración → Permisos para usar esto.', 'warning');
      return;
    }
    if (!navigator.geolocation) {
      this.presentToast('Geolocalización no disponible.', 'danger');
      return;
    }
    this.estaCargando = true;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        this.userPositionMarker = coords;
        this.map.setCenter(coords);
        this.map.setZoom(14);
        if (this.userMarker) this.userMarker.setMap(null);
        this.userMarker = new google.maps.Marker({
          position: coords,
          map: this.map,
          title: 'Tu ubicación',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: '#2563eb',
            fillOpacity: 0.9,
            strokeColor: '#fff',
            strokeWeight: 2,
          },
        });
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

  // Carga el script de Google Maps JS una sola vez (necesario porque la key
  // viene de environment.ts, así que no se puede fijar en un <script> estático
  // de index.html).
  private cargarGoogleMaps(): Promise<void> {
    if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
    if (this.googleMapsLoadPromise) return this.googleMapsLoadPromise;

    this.googleMapsLoadPromise = new Promise((resolve, reject) => {
      (window as any).__ashbisGoogleMapsReady = () => resolve();
      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googlePlacesApiKey}&libraries=places&language=es&callback=__ashbisGoogleMapsReady`;
      script.async = true;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'));
      document.head.appendChild(script);
    });
    return this.googleMapsLoadPromise;
  }

  async searchNearbyPlaces(coords: { lat: number; lng: number }) {
    this.estaCargando = true;
    this.limpiarMarcadores();

    try {
      const places = await this.buscarPlacesConCache(coords, this.currentSearchType!);
      await this.procesarResultados(places);
    } catch (err) {
      console.error('Error Places API:', err);
      this.estaCargando = false;
      this.presentToast('No se pudo conectar con Google Places. Intenta en unos minutos.', 'danger');
    }
  }

  // Evita repetir la misma consulta a Places API si el usuario busca de nuevo
  // en la misma zona (~100 m, por el toFixed(3)) durante la misma sesión.
  private async buscarPlacesConCache(
    coords: { lat: number; lng: number },
    tipo: 'veterinary_care' | 'pet_store'
  ): Promise<any[]> {
    const key = `${tipo}_${coords.lat.toFixed(3)}_${coords.lng.toFixed(3)}`;
    const cacheado = this.cacheResultados.get(key);
    if (cacheado) return cacheado;

    await this.cargarGoogleMaps();
    const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary('places');

    const { places } = await Place.searchNearby({
      fields: [
        'id', 'displayName', 'formattedAddress', 'location', 'rating',
        'businessStatus', 'regularOpeningHours', 'nationalPhoneNumber', 'websiteURI'
      ],
      locationRestriction: { center: coords, radius: 5000 },
      includedPrimaryTypes: [tipo],
      maxResultCount: 20,
      rankPreference: SearchNearbyRankPreference.DISTANCE,
      language: 'es',
    });

    const resultados = places || [];
    this.cacheResultados.set(key, resultados);
    return resultados;
  }

  private async procesarResultados(places: any[]) {
    this.estaCargando = false;

    if (!places.length) {
      this.presentToast('No se encontraron lugares en 5 km.', 'warning');
      return;
    }

    // Una sola llamada a Firestore para todos los lugares
    const infoExtra = await runInInjectionContext(this.injector, () =>
      this.firestoreService.getLugaresInfo(places.map(p => p.id))
    );

    this.marcadoresEnMapa = places
      .filter(p => p.location)
      .map(p => ({
        lat:          p.location.lat(),
        lng:          p.location.lng(),
        title:        p.displayName || (this.currentSearchType === 'veterinary_care' ? 'Veterinaria' : 'Tienda de mascotas'),
        address:      p.formattedAddress || 'Dirección no disponible',
        placeId:      p.id,
        tipo:         this.currentSearchType!,
        phone:        p.nationalPhoneNumber,
        website:      p.websiteURI,
        openingHours: p.regularOpeningHours?.weekdayDescriptions?.join('\n'),
        isOpen:       p.businessStatus && p.businessStatus !== 'OPERATIONAL'
                        ? false
                        : (p.regularOpeningHours?.openNow ?? null),
        rating:       p.rating,
        userInfo:     infoExtra[p.id],
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
      const marker = new google.maps.Marker({
        position: { lat: m.lat, lng: m.lng },
        map: this.map,
        icon: this.crearIcono(m.tipo, m.isOpen),
      });
      marker.addListener('click', () => this.seleccionarMarcador(m));
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
      this.map.panTo({ lat: m.lat, lng: m.lng });
      this.map.setZoom(Math.max(this.map.getZoom(), 15));
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

  /** google.maps.Marker (a diferencia de los divIcon de Leaflet) no expone
   *  el nodo DOM del pin para alternarle una clase CSS — se resuelve
   *  regenerando el ícono de cada marcador, más grande y con anillo blanco
   *  el que está seleccionado. Son pocos marcadores (máx. 20 por búsqueda),
   *  así que no es costoso. */
  private resaltarMarcadorEnMapa(placeId?: string) {
    this.markerRefs.forEach((marker, id) => {
      const m = this.marcadoresEnMapa.find(x => x.placeId === id);
      if (!m) return;
      marker.setIcon(this.crearIcono(m.tipo, m.isOpen, id === placeId));
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
  private crearIcono(tipo: 'veterinary_care' | 'pet_store', isOpen: boolean | null | undefined, seleccionado = false): any {
    const colorAbierto     = tipo === 'veterinary_care' ? '#dc2626' : '#16a34a';
    const colorCerrado     = '#6b7280';
    const colorDesconocido = tipo === 'veterinary_care' ? '#fca5a5' : '#86efac';
    const color  = isOpen === true ? colorAbierto : isOpen === false ? colorCerrado : colorDesconocido;
    const glifo  = tipo === 'veterinary_care' ? '🐾' : '🛍️';
    const base   = isOpen === true ? 38 : 32;
    const tamano = seleccionado ? base + 8 : base;
    const anillo = seleccionado ? `<circle cx="24" cy="24" r="21" fill="none" stroke="#fff" stroke-width="3"/>` : '';

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">`
      + `<circle cx="24" cy="24" r="19" fill="${color}" stroke="#fff" stroke-width="2"/>`
      + anillo
      + `<text x="24" y="31" font-size="19" text-anchor="middle">${glifo}</text>`
      + `</svg>`;

    return {
      url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
      scaledSize: new google.maps.Size(tamano, tamano),
      anchor: new google.maps.Point(tamano / 2, tamano / 2),
    };
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

  irAQR() {
    this.router.navigate(['/tabs/mascota-qr']);
  }

  irAHistorial() {
    const uid = this.auth.getCurrentUser()?.uid;
    if (!uid) return;

    runInInjectionContext(this.injector, () => this.firestoreService.getUserPets(uid))
      .pipe(take(1))
      .subscribe(mascotas => {
        if (mascotas.length === 1) {
          this.router.navigate(['/tabs/mascota-detalle', mascotas[0].id]);
        } else if (mascotas.length > 1) {
          this.router.navigate(['/tabs/listar-mascotas']);
        } else {
          this.router.navigate(['/tabs/crear-mascotas']);
        }
      });
  }
}