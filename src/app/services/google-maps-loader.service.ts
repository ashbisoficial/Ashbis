import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';

/** Carga el script de Google Maps JS una sola vez para toda la app (comparte
 *  el mismo `window.google` que ya usa home.component.ts para el mapa y la
 *  búsqueda de Veterinaria/Tienda — si ya está cargado, no vuelve a pedirlo). */
@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private cargaEnCurso?: Promise<void>;

  cargar(): Promise<void> {
    if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
    if (this.cargaEnCurso) return this.cargaEnCurso;

    this.cargaEnCurso = new Promise((resolve, reject) => {
      (window as any).__ashbisGoogleMapsReady = (window as any).__ashbisGoogleMapsReady || (() => resolve());
      if ((window as any).google?.maps?.importLibrary) { resolve(); return; }
      const yaHayScript = document.querySelector('script[data-ashbis-google-maps]');
      if (yaHayScript) {
        yaHayScript.addEventListener('load', () => resolve());
        return;
      }
      const script = document.createElement('script');
      script.dataset['ashbisGoogleMaps'] = '1';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${environment.googlePlacesApiKey}&libraries=places&language=es&callback=__ashbisGoogleMapsReady`;
      script.async = true;
      script.onerror = () => reject(new Error('No se pudo cargar Google Maps.'));
      document.head.appendChild(script);
    });
    return this.cargaEnCurso;
  }
}
