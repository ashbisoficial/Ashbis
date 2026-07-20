import { Injectable } from '@angular/core';

export type Tema = 'oscuro' | 'claro';
export type TamanoTexto = 'pequeno' | 'normal' | 'grande' | 'muy-grande';

const CLAVE_TEMA = 'ashbis-tema';
const CLAVE_TAMANO_TEXTO = 'ashbis-tamano-texto';

const ESCALAS_TEXTO: Record<TamanoTexto, number> = {
  'pequeno': 92,
  'normal': 100,
  'grande': 112,
  'muy-grande': 124,
};

/**
 * Preferencias de apariencia (tema claro/oscuro, tamaño de texto),
 * persistidas en localStorage y aplicadas como clase/CSS var en <html>.
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
  private temaActual: Tema = 'oscuro';
  private tamanoActual: TamanoTexto = 'normal';

  constructor() {
    this.temaActual = (localStorage.getItem(CLAVE_TEMA) as Tema) || 'oscuro';
    this.tamanoActual = (localStorage.getItem(CLAVE_TAMANO_TEXTO) as TamanoTexto) || 'normal';
    this.aplicarTema(this.temaActual);
    this.aplicarTamanoTexto(this.tamanoActual);
  }

  get tema(): Tema {
    return this.temaActual;
  }

  get tamanoTexto(): TamanoTexto {
    return this.tamanoActual;
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
