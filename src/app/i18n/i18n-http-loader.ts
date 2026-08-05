import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TranslateLoader, TranslationObject } from '@ngx-translate/core';

/** Carga los diccionarios de traducción desde /assets/i18n/{lang}.json.
 *  Implementación propia y mínima en vez del paquete
 *  @ngx-translate/http-loader: solo necesitamos un GET simple, y así
 *  evitamos una dependencia extra por una sola función. */
export class I18nHttpLoader extends TranslateLoader {
  constructor(private http: HttpClient) {
    super();
  }

  getTranslation(lang: string): Observable<TranslationObject> {
    return this.http.get<TranslationObject>(`/assets/i18n/${lang}.json`);
  }
}
