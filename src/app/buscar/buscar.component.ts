import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
  IonSearchbar, IonIcon, IonSpinner, IonButton,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import {
  medkitOutline, cutOutline, homeOutline, flowerOutline,
  locationOutline, callOutline, globeOutline, logoInstagram, logoFacebook,
  logoWhatsapp, chevronBackOutline, shieldCheckmarkOutline, navigateOutline,
  optionsOutline, pawOutline,
} from 'ionicons/icons';
import { Subject, combineLatest, takeUntil } from 'rxjs';
import { AuthenticationService } from '../firebase/authentication';
import { FirestoreService } from '../firebase/firestore';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';
import { PreferenciasService } from '../services/preferencias.service';
import { Models } from '../models/models';

declare const google: any;

type Categoria = Models.Buscador.CategoriaProfesional;
type Vista = 'categorias' | 'resultados' | 'detalle';
type OrdenResultados = 'recomendado' | 'cercania';

interface CategoriaConfig {
  valor: Categoria;
  icono: string;
  labelKey: string;
  emoji: string;
}

const CATEGORIAS: CategoriaConfig[] = [
  { valor: 'veterinario', icono: 'medkit-outline', labelKey: 'buscar.veterinario', emoji: '🩺' },
  { valor: 'peluqueria', icono: 'cut-outline', labelKey: 'buscar.peluqueria', emoji: '✂️' },
  { valor: 'guarderia', icono: 'home-outline', labelKey: 'buscar.guarderia', emoji: '🏠' },
  { valor: 'funeraria', icono: 'flower-outline', labelKey: 'buscar.funeraria', emoji: '🌷' },
];

@Component({
  selector: 'app-buscar',
  standalone: true,
  templateUrl: './buscar.component.html',
  styleUrls: ['./buscar.component.scss'],
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonToolbar, IonTitle, IonButtons,
    IonSearchbar, IonIcon, IonSpinner, IonButton,
    TranslatePipe,
  ],
})
export class BuscarComponent implements OnInit, OnDestroy {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);
  private readonly preferencias = inject(PreferenciasService);
  private readonly destroy$ = new Subject<void>();

  readonly categorias = CATEGORIAS;

  vista: Vista = 'categorias';
  categoriaActual: Categoria | null = null;
  textoBusqueda = '';
  orden: OrdenResultados = 'recomendado';

  cargando = false;
  resultados: Models.Buscador.ProfesionalPublico[] = [];
  profesionalSeleccionado: Models.Buscador.ProfesionalPublico | null = null;

  /** Especies de las mascotas del usuario (para el ranking "recomendado
   *  para ti" — ver rankear()); se llenan una sola vez al entrar. */
  private especiesUsuario: string[] = [];
  private miUbicacion: { lat: number; lng: number } | null = null;

  private map: any = null;
  private marker: any = null;

  constructor() {
    addIcons({
      medkitOutline, cutOutline, homeOutline, flowerOutline,
      locationOutline, callOutline, globeOutline, logoInstagram, logoFacebook,
      logoWhatsapp, chevronBackOutline, shieldCheckmarkOutline, navigateOutline,
      optionsOutline, pawOutline,
    });
  }

  ngOnInit(): void {
    const uid = this.auth.getCurrentUser()?.uid;
    if (!uid) return;
    this.fs.getUserPets(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mascotas => {
        this.especiesUsuario = Array.from(new Set(mascotas.map(m => m.especie).filter(Boolean)));
      });

    if (this.preferencias.ubicacionHabilitada && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          this.miUbicacion = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          if (this.resultados.length) this.resultados = this.rankear(this.resultados);
        },
        () => { /* sin ubicación, el buscador igual funciona — solo sin ordenar por cercanía */ },
        { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60_000 }
      );
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.map) google.maps.event.clearInstanceListeners(this.map);
  }

  abrirCategoria(cat: Categoria): void {
    this.categoriaActual = cat;
    this.vista = 'resultados';
    this.cargando = true;
    this.fs.getProfesionalesPorCategoria(cat)
      .pipe(takeUntil(this.destroy$))
      .subscribe(lista => {
        this.resultados = this.rankear(lista);
        this.cargando = false;
      });
  }

  /** Buscar desde la pantalla de categorías (sin elegir una primero) trae
   *  resultados de las 4 categorías combinadas — categoriaActual queda en
   *  null, y la vista de resultados lo maneja mostrando el emoji genérico
   *  de cada tarjeta en vez del de una sola categoría. */
  buscarEnTodas(): void {
    const texto = this.textoBusqueda.trim();
    if (!texto) return;
    this.categoriaActual = null;
    this.vista = 'resultados';
    this.cargando = true;
    combineLatest(this.categorias.map(c => this.fs.getProfesionalesPorCategoria(c.valor)))
      .pipe(takeUntil(this.destroy$))
      .subscribe(listas => {
        const combinados = listas.reduce<Models.Buscador.ProfesionalPublico[]>((acc, l) => acc.concat(l), []);
        this.resultados = this.rankear(combinados);
        this.cargando = false;
      });
  }

  volverACategorias(): void {
    this.vista = 'categorias';
    this.categoriaActual = null;
    this.resultados = [];
    this.textoBusqueda = '';
  }

  get resultadosFiltrados(): Models.Buscador.ProfesionalPublico[] {
    const texto = this.textoBusqueda.trim().toLowerCase();
    if (!texto) return this.resultados;
    return this.resultados.filter(p =>
      p.nombre.toLowerCase().includes(texto) ||
      p.direccionNegocio?.toLowerCase().includes(texto)
    );
  }

  toggleOrden(): void {
    this.orden = this.orden === 'recomendado' ? 'cercania' : 'recomendado';
    this.resultados = this.rankear(this.resultados);
  }

  /** "Recomendado para ti": primero los negocios cuyas especiesAtendidas
   *  coinciden con las especies de las mascotas registradas del usuario
   *  (ej. conejo → veterinario exótico), después por cercanía si hay
   *  ubicación disponible, y por último alfabético. En orden "cercanía" se
   *  salta el puntaje por especie y ordena directo por distancia. */
  private rankear(lista: Models.Buscador.ProfesionalPublico[]): Models.Buscador.ProfesionalPublico[] {
    return [...lista].sort((a, b) => {
      if (this.orden === 'recomendado') {
        const puntajeA = this.puntajeEspecie(a);
        const puntajeB = this.puntajeEspecie(b);
        if (puntajeA !== puntajeB) return puntajeB - puntajeA;
      }
      const distA = this.distanciaA(a);
      const distB = this.distanciaA(b);
      if (distA != null && distB != null && distA !== distB) return distA - distB;
      if (distA != null && distB == null) return -1;
      if (distA == null && distB != null) return 1;
      return a.nombre.localeCompare(b.nombre);
    });
  }

  private puntajeEspecie(p: Models.Buscador.ProfesionalPublico): number {
    if (!p.especiesAtendidas?.length || !this.especiesUsuario.length) return 0;
    return p.especiesAtendidas.some(e => this.especiesUsuario.includes(e)) ? 1 : 0;
  }

  esRecomendado(p: Models.Buscador.ProfesionalPublico): boolean {
    return this.puntajeEspecie(p) > 0;
  }

  private distanciaA(p: Models.Buscador.ProfesionalPublico): number | null {
    if (!this.miUbicacion || p.latNegocio == null || p.lngNegocio == null) return null;
    return this.distanciaMetros(this.miUbicacion.lat, this.miUbicacion.lng, p.latNegocio, p.lngNegocio);
  }

  distanciaTexto(p: Models.Buscador.ProfesionalPublico): string | null {
    const d = this.distanciaA(p);
    if (d == null) return null;
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
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

  emojiCategoria(categoria: Categoria): string {
    return this.categorias.find(c => c.valor === categoria)?.emoji || '📍';
  }

  /** Título de la barra de resultados: la categoría elegida, o "Todos los
   *  resultados" cuando se buscó desde la pantalla de categorías sin elegir
   *  ninguna (ver buscarEnTodas). */
  get tituloResultados(): string {
    if (!this.categoriaActual) return '';
    const cat = this.categorias.find(c => c.valor === this.categoriaActual);
    return cat?.labelKey || '';
  }

  // ── Detalle + mapa in-app (no redirige a Google Maps externo) ───────────

  errorMapa = false;

  async verEnMapa(p: Models.Buscador.ProfesionalPublico): Promise<void> {
    this.profesionalSeleccionado = p;
    this.vista = 'detalle';
    this.errorMapa = false;
    if (p.latNegocio == null || p.lngNegocio == null) return;

    try {
      await this.mapsLoader.cargar();
      const { Map } = await google.maps.importLibrary('maps');
      // El contenedor recién existe en el DOM después de que *ngIf pinte la
      // vista "detalle" — un tick asíncrono alcanza sin depender de ViewChild.
      setTimeout(() => {
        const el = document.getElementById('buscar-mapa-detalle');
        if (!el) return;
        const centro = { lat: p.latNegocio!, lng: p.lngNegocio! };
        this.map = new Map(el, {
          center: centro,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        });
        // Marker clásico (no AdvancedMarkerElement): igual criterio que
        // home.component.ts — evita depender de un Map ID que el proyecto no
        // tiene configurado.
        this.marker = new google.maps.Marker({ position: centro, map: this.map, title: p.nombre });
      }, 50);
    } catch {
      // Sin conexión o Google Maps no cargó: no lo dejamos en un mapa vacío
      // sin explicación — ver .aviso-sin-mapa en el template.
      this.errorMapa = true;
    }
  }

  volverAResultados(): void {
    this.vista = 'resultados';
    this.profesionalSeleccionado = null;
    if (this.map) { google.maps.event.clearInstanceListeners(this.map); this.map = null; }
  }

  abrirLink(url?: string): void {
    if (!url) return;
    window.open(url, '_blank', 'noopener');
  }

  abrirWhatsapp(numero?: string): void {
    if (!numero) return;
    window.open(`https://wa.me/${numero.replace(/\D/g, '')}`, '_blank', 'noopener');
  }

  abrirTelefono(numero?: string): void {
    if (!numero) return;
    window.open(`tel:${numero}`, '_self');
  }
}
