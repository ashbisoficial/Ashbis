import { Injectable } from '@angular/core';
import jsQR from 'jsqr';

/**
 * Decodifica un código QR a partir de una foto (no cámara en vivo) — mismo
 * patrón que ya usa el resto de la app para fotos: un <input type="file">
 * con accept="image/*", sin pedir un permiso de cámara nuevo ni sumar un
 * plugin nativo.
 */
@Injectable({ providedIn: 'root' })
export class QrDecodeService {
  decodificarArchivo(file: File): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        try {
          // Las cámaras de celular sacan fotos enormes (4000x3000+): eso
          // hace más lento el decode y, sobre todo, empeora la detección
          // cuando se fotografía un QR mostrado en OTRA pantalla (moiré/
          // glare). Se prueba primero achicada — más rápido y más
          // tolerante a ese ruido — y si falla, se reintenta a tamaño
          // original por si el QR era chico dentro de la foto.
          const resultadoChico = this.intentarDecodificar(img, 1000);
          resolve(resultadoChico ?? this.intentarDecodificar(img, null));
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen.')); };
      img.src = url;
    });
  }

  private intentarDecodificar(img: HTMLImageElement, maxDim: number | null): string | null {
    const escala = maxDim ? Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight)) : 1;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.naturalWidth * escala);
    canvas.height = Math.round(img.naturalHeight * escala);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const resultado = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });
    return resultado?.data ?? null;
  }
}
