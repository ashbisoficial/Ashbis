import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonSearchbar,
  IonCard,
  IonCardContent,
  IonIcon,
  IonButton,
  IonBadge,
  IonSpinner,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  searchOutline, callOutline, locationOutline, globeOutline,
  logoInstagram, logoFacebook, logoWhatsapp, shieldCheckmarkOutline,
  medkitOutline, appsOutline, storefrontOutline, bagHandleOutline, sparklesOutline,
} from 'ionicons/icons';
import { Subscription, takeUntil, Subject } from 'rxjs';
import { FirestoreService } from '../firebase/firestore';
import { AuthenticationService } from '../firebase/authentication';
import { Models } from '../models/models';

type FiltroRol = 'todos' | 'veterinario' | 'servicio' | 'pyme';

const ETIQUETAS_TIPO: Record<string, string> = {
  independiente: 'Veterinario/a independiente',
  clinica_pequena: 'Clínica pequeña',
  clinica_grande: 'Clínica grande',
  peluqueria: 'Peluquería o servicios estéticos',
  guarderia: 'Guardería o pensión',
  funeraria: 'Servicios funerarios',
  hotel: 'Hotel para mascotas',
  transporte: 'Transporte de mascotas',
  ropa: 'Ropa y accesorios de vestir',
  juguetes: 'Juguetes',
  accesorios: 'Accesorios (correas, comederos, camas...)',
  comida: 'Alimento para mascotas',
  snacks: 'Snacks y premios',
  otro: 'Otro',
};

const ETIQUETAS_MODALIDAD: Record<string, string> = {
  presencial: 'Atención presencial',
  a_domicilio: 'Atención a domicilio',
  ambas: 'Presencial y a domicilio',
};

interface CategoriaBuscador {
  valor: FiltroRol;
  label: string;
  icono: string;
}

const CATEGORIAS: CategoriaBuscador[] = [
  { valor: 'todos', label: 'Todos', icono: 'apps-outline' },
  { valor: 'veterinario', label: 'Veterinarios', icono: 'medkit-outline' },
  { valor: 'servicio', label: 'Servicios', icono: 'storefront-outline' },
  { valor: 'pyme', label: 'Pymes', icono: 'bag-handle-outline' },
];

/** Especialidades más comunes para filtrar veterinarios — el campo real
 *  (especialidades) es texto libre separado por coma (ver veterinario-panel),
 *  así que acá se matchea por inclusión, no por un enum cerrado como
 *  tipoServicio/tipoPyme. "General" no filtra nada, es el estado por defecto. */
const ESPECIALIDADES_VETERINARIO = [
  'General', 'Cardiología', 'Oncología', 'Odontología', 'Dermatología', 'Cirugía', 'Oftalmología',
];

const TIPOS_SERVICIO: Models.Auth.TipoServicio[] = ['peluqueria', 'guarderia', 'funeraria', 'hotel', 'transporte'];
const TIPOS_PYME: Models.Auth.TipoPyme[] = ['ropa', 'juguetes', 'accesorios', 'comida', 'snacks', 'otro'];

/**
 * Buscador: directorio público de veterinarios, servicios (peluquería/
 * estética, guardería/pensión, funeraria, hotel, transporte) y pymes
 * (ropa/juguetes/accesorios/comida/snacks) registrados en Ashbis. Refugios
 * no están acá — sus publicaciones de adopción/donación ya son públicas y
 * tienen su propio feed en Home.
 */
@Component({
  selector: 'app-buscador',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar, IonSearchbar,
    IonCard, IonCardContent,
    IonIcon, IonButton, IonBadge, IonSpinner,
  ],
  templateUrl: './buscador.component.html',
  styleUrls: ['./buscador.component.scss'],
})
export class BuscadorComponent implements OnInit, OnDestroy {
  private readonly fs = inject(FirestoreService);
  private readonly auth = inject(AuthenticationService);
  private sub?: Subscription;
  private readonly destroy$ = new Subject<void>();

  cargando = signal(true);
  entradas = signal<Models.DirectorioPublico.EntradaDirectorio[]>([]);
  filtroTexto = '';
  filtroRol = signal<FiltroRol>('todos');
  /** Subopción elegida dentro de la categoría (especialidad/tipoServicio/
   *  tipoPyme según corresponda) — null mientras no se eligió ninguna, o
   *  cuando la categoría es 'todos' (no tiene subopciones). */
  filtroSubtipo = signal<string | null>(null);

  /** Especies de las mascotas propias de quien está mirando el buscador
   *  (en minúsculas, para comparar sin problemas de mayúsculas) — vacío si
   *  no está logueado o no tiene mascotas. Alimenta la recomendación de la
   *  pestaña "Todos" (ver puntajeRecomendacion). */
  private misEspecies = signal<Set<string>>(new Set());
  private miRegion = signal<string | null>(null);
  private miComuna = signal<string | null>(null);

  readonly etiquetasTipo = ETIQUETAS_TIPO;
  readonly etiquetasModalidad = ETIQUETAS_MODALIDAD;
  readonly categorias = CATEGORIAS;

  readonly subopciones = computed<string[]>(() => {
    switch (this.filtroRol()) {
      case 'veterinario': return ESPECIALIDADES_VETERINARIO;
      case 'servicio': return TIPOS_SERVICIO;
      case 'pyme': return TIPOS_PYME;
      default: return [];
    }
  });

  resultados = computed(() => {
    const rol = this.filtroRol();
    const subtipo = this.filtroSubtipo();
    const texto = this.filtroTexto.trim().toLowerCase();
    const filtrados = this.entradas().filter(e => {
      if (rol !== 'todos' && e.rol !== rol) return false;

      if (subtipo && subtipo !== 'General') {
        if (rol === 'veterinario') {
          const especialidades = (e.especialidades ?? []).map(x => x.toLowerCase());
          if (!especialidades.some(x => x.includes(subtipo.toLowerCase()))) return false;
        } else if (rol === 'servicio' || rol === 'pyme') {
          if (e.tipo !== subtipo) return false;
        }
      }

      if (!texto) return true;
      const campos = [
        e.nombre, e.tipo ? this.etiquetasTipo[e.tipo] : '', e.comuna, e.region,
        ...(e.especialidades ?? []), ...(e.especiesAtendidas ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return campos.includes(texto);
    });

    // Recomendación: solo en "Todos" tiene sentido priorizar — dentro de
    // una categoría ya elegida (Veterinarios/Servicios/Pymes) el orden
    // natural alcanza. Ordena por puntaje sin alterar la lista si nadie
    // puntúa (ej. usuario sin mascotas cargadas ni región/comuna).
    if (rol === 'todos') {
      return [...filtrados].sort((a, b) => this.puntajeRecomendacion(b) - this.puntajeRecomendacion(a));
    }
    return filtrados;
  });

  /** Prioriza, en este orden: veterinarios que atienden la especie de
   *  alguna mascota propia, negocios en la misma comuna, negocios en la
   *  misma región, y cuentas de veterinario ya verificadas por Ashbis.
   *  Nada de esto es obligatorio ni oculta resultados — solo cambia el
   *  orden dentro de "Todos". */
  private puntajeRecomendacion(e: Models.DirectorioPublico.EntradaDirectorio): number {
    let puntaje = 0;
    const especies = this.misEspecies();
    if (especies.size && e.rol === 'veterinario') {
      const atiende = (e.especiesAtendidas ?? []).map(x => x.toLowerCase());
      if (atiende.some(x => especies.has(x))) puntaje += 5;
    }
    const miComuna = this.miComuna();
    const miRegion = this.miRegion();
    if (miComuna && e.comuna === miComuna) puntaje += 2;
    else if (miRegion && e.region === miRegion) puntaje += 1;
    if (e.rol === 'veterinario' && e.verificado) puntaje += 1;
    return puntaje;
  }

  /** Para mostrar el badge "Recomendado" en la vista de plantilla —
   *  cualquier puntaje mayor a cero significa que hubo al menos una
   *  coincidencia real (especie, comuna, región o verificado). */
  esRecomendado(e: Models.DirectorioPublico.EntradaDirectorio): boolean {
    return this.filtroRol() === 'todos' && this.puntajeRecomendacion(e) > 0;
  }

  constructor() {
    addIcons({
      searchOutline, callOutline, locationOutline, globeOutline,
      logoInstagram, logoFacebook, logoWhatsapp, shieldCheckmarkOutline,
      medkitOutline, appsOutline, storefrontOutline, bagHandleOutline, sparklesOutline,
    });
  }

  ngOnInit(): void {
    this.sub = this.fs.getDirectorioPublico().subscribe(lista => {
      this.entradas.set(lista ?? []);
      this.cargando.set(false);
    });
    this.cargarDatosRecomendacion();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Carga, una sola vez, lo necesario para puntuar la recomendación:
   *  especies de las mascotas propias y región/comuna del perfil. Si no
   *  hay sesión (no debería pasar dentro de /tabs, pero por las dudas) o
   *  la persona no tiene mascotas/región cargada, el buscador sigue
   *  funcionando igual, solo sin reordenar nada. */
  private cargarDatosRecomendacion(): void {
    const uid = this.auth.getCurrentUser()?.uid;
    if (!uid) return;

    this.fs.getUserPetsPropios(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe(mascotas => {
        const especies = new Set(
          mascotas.map(m => (m.especie || '').toLowerCase()).filter(Boolean)
        );
        this.misEspecies.set(especies);
      });

    this.fs.getDocument(`usuarios/${uid}`).then(perfil => {
      this.miRegion.set(perfil?.region || null);
      this.miComuna.set(perfil?.comuna || null);
    });
  }

  cambiarFiltroRol(v: FiltroRol): void {
    this.filtroRol.set(v);
    // Cambiar de categoría invalida cualquier subopción elegida antes —
    // "Cardiología" no significa nada si después se pasa a "Servicios".
    this.filtroSubtipo.set(null);
  }

  cambiarSubtipo(v: string): void {
    this.filtroSubtipo.set(this.filtroSubtipo() === v ? null : v);
  }

  etiquetaSubopcion(valor: string): string {
    return this.etiquetasTipo[valor] || valor;
  }

  iconoPara(rol: Models.DirectorioPublico.EntradaDirectorio['rol']): string {
    if (rol === 'veterinario') return 'medkit-outline';
    if (rol === 'pyme') return 'bag-handle-outline';
    return 'storefront-outline';
  }

  abrirLink(url: string): void {
    window.open(url, '_blank', 'noopener');
  }
}
