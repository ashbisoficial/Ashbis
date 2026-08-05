import { Directive, ElementRef, EventEmitter, Output, inject } from '@angular/core';
import { IonInput } from '@ionic/angular/standalone';
import { GoogleMapsLoaderService } from '../services/google-maps-loader.service';

// Igual que en home.component.ts: la librería Places se carga dinámicamente
// (importLibrary), así que no hay tipos oficiales instalados para "google".
declare const google: any;

export interface LugarSeleccionado {
  direccion: string;
  lat: number;
  lng: number;
}

/** Convierte un ion-input común en un campo con autocompletado de
 *  direcciones de Google Places — mismo buscador que ya usa Home. Al elegir
 *  una sugerencia de la lista, emite el texto formateado + sus coordenadas;
 *  si la persona escribe la dirección a mano sin elegir ninguna sugerencia,
 *  el ngModel del input sigue funcionando igual (el directive no bloquea
 *  nada), simplemente no hay coordenadas para esa dirección. */
@Directive({
  selector: 'ion-input[appPlacesAutocomplete]',
  standalone: true,
})
export class PlacesAutocompleteDirective {
  private readonly hostEl = inject(ElementRef<IonInput>);
  private readonly mapsLoader = inject(GoogleMapsLoaderService);

  @Output() lugarSeleccionado = new EventEmitter<LugarSeleccionado>();

  constructor() {
    this.configurar();
  }

  private async configurar(): Promise<void> {
    const ionInput = this.hostEl.nativeElement as unknown as IonInput;
    // ion-input recién crea su <input> nativo dentro del shadow DOM de forma
    // asíncrona — getInputElement() devuelve una promesa que resuelve apenas
    // existe, así que no hace falta esperar un ciclo de detección aparte.
    const [nativeInput] = await Promise.all([
      ionInput.getInputElement(),
      this.mapsLoader.cargar(),
    ]);

    const { Autocomplete } = await google.maps.importLibrary('places');
    const autocomplete = new Autocomplete(nativeInput, {
      fields: ['formatted_address', 'geometry'],
      types: ['address'],
    });
    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      const location = place.geometry?.location;
      if (!location) return; // eligieron "buscar" sin seleccionar una sugerencia real
      this.lugarSeleccionado.emit({
        direccion: place.formatted_address || nativeInput.value || '',
        lat: location.lat(),
        lng: location.lng(),
      });
    });
  }
}
