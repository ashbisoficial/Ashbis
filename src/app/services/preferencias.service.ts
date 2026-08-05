import { inject, Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Tema = 'oscuro' | 'claro';
export type TamanoTexto = 'pequeno' | 'normal' | 'grande' | 'muy-grande';
export type Idioma = 'es' | 'en';

const CLAVE_TEMA = 'ashbis-tema';
const CLAVE_TAMANO_TEXTO = 'ashbis-tamano-texto';
const CLAVE_CAMARA = 'ashbis-camara-habilitada';
const CLAVE_UBICACION = 'ashbis-ubicacion-habilitada';
const CLAVE_IDIOMA = 'ashbis-idioma';

const ESCALAS_TEXTO: Record<TamanoTexto, number> = {
  'pequeno': 92,
  'normal': 100,
  'grande': 112,
  'muy-grande': 124,
};

/**
 * Preferencias de apariencia (tema claro/oscuro, tamaño de texto) y de uso
 * de cámara/ubicación, persistidas en localStorage y aplicadas como
 * clase/CSS var en <html> (apariencia) o leídas por los componentes que
 * disparan esas funciones (cámara/ubicación).
 *
 * camaraHabilitada/ubicacionHabilitada NO son el permiso real del
 * navegador/SO — eso nunca se puede revocar por código, solo la persona
 * puede hacerlo desde la configuración de su dispositivo (ver
 * ConfiguracionComponent). Son un interruptor propio de Ashbis: si está
 * apagado, la app directamente no llama a esas APIs aunque el permiso del
 * navegador siga concedido.
 *
 * Además de la clase, fija --ion-background-color/--ion-text-color y el
 * `color-scheme` real del documento: index.html declara
 * `<meta name="color-scheme" content="light dark">`, así que si no se fija
 * explícitamente acá, un sistema con modo oscuro activo hace que el propio
 * navegador pinte de negro cualquier superficie que dependa de esas
 * variables sin que nuestro CSS se entere (bug real, visto en producción).
 */
@Injectable({ providedIn: 'root' })
export class PreferenciasService {
  private readonly translate = inject(TranslateService);

  private temaActual: Tema = 'oscuro';
  private tamanoActual: TamanoTexto = 'normal';
  private camaraActual = true;
  private ubicacionActual = true;
  private idiomaActual: Idioma = 'es';

  constructor() {
    this.temaActual = (localStorage.getItem(CLAVE_TEMA) as Tema) || 'oscuro';
    this.tamanoActual = (localStorage.getItem(CLAVE_TAMANO_TEXTO) as TamanoTexto) || 'normal';
    this.camaraActual = localStorage.getItem(CLAVE_CAMARA) !== 'false';
    this.ubicacionActual = localStorage.getItem(CLAVE_UBICACION) !== 'false';
    this.idiomaActual = (localStorage.getItem(CLAVE_IDIOMA) as Idioma) || 'es';
    this.aplicarTema(this.temaActual);
    this.aplicarTamanoTexto(this.tamanoActual);
    this.translate.use(this.idiomaActual);
  }

  get tema(): Tema {
    return this.temaActual;
  }

  get tamanoTexto(): TamanoTexto {
    return this.tamanoActual;
  }

  get camaraHabilitada(): boolean {
    return this.camaraActual;
  }

  get ubicacionHabilitada(): boolean {
    return this.ubicacionActual;
  }

  get idioma(): Idioma {
    return this.idiomaActual;
  }

  setTema(tema: Tema): void {
    this.temaActual = tema;
    localStorage.setItem(CLAVE_TEMA, tema);
    this.aplicarTema(tema);
  }

  setTamanoTexto(tamano: TamanoTexto): void {
    this.tamanoActual = tamano;
    localStorage.setItem(CLAVE_TAMANO_TEXTO, tamano);
    this.aplicarTamanoTexto(tamano);
  }

  setCamaraHabilitada(habilitada: boolean): void {
    this.camaraActual = habilitada;
    localStorage.setItem(CLAVE_CAMARA, String(habilitada));
  }

  setUbicacionHabilitada(habilitada: boolean): void {
    this.ubicacionActual = habilitada;
    localStorage.setItem(CLAVE_UBICACION, String(habilitada));
  }

  setIdioma(idioma: Idioma): void {
    this.idiomaActual = idioma;
    localStorage.setItem(CLAVE_IDIOMA, idioma);
    this.translate.use(idioma);
  }

  private aplicarTema(tema: Tema): void {
    document.documentElement.classList.toggle('ion-palette-dark', tema === 'oscuro');
    document.documentElement.classList.toggle('ashbis-light', tema === 'claro');
    // Alinea el color-scheme real del documento con el tema elegido, para
    // que el navegador no pinte con el esquema del sistema operativo por
    // su cuenta en huecos que nuestro CSS no cubra explícitamente.
    document.documentElement.style.colorScheme = tema === 'oscuro' ? 'dark' : 'light';
  }

  private aplicarTamanoTexto(tamano: TamanoTexto): void {
    document.documentElement.style.setProperty('--ashbis-font-scale', `${ESCALAS_TEXTO[tamano]}%`);
  }
}
