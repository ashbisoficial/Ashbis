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
 * El tema claro alcanza hoy al "chrome" compartido de la app (tabs,
 * alerts/toasts, la página de Configuración) y a las pantallas que ya usan
 * las variables de color de Ionic. Login/Registro mantienen su diseño oscuro
 * de marca a propósito (son pantallas previas a iniciar sesión, sin
 * preferencia de cuenta todavía). Extender el tema claro al resto de
 * pantallas internas es trabajo de seguimiento — ver nota en el commit.
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
  }

  private aplicarTamanoTexto(tamano: TamanoTexto): void {
    document.documentElement.style.setProperty('--ashbis-font-scale', `${ESCALAS_TEXTO[tamano]}%`);
  }
}
