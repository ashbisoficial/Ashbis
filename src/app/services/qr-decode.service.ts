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
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext('2d');
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const resultado = jsQR(imageData.data, imageData.width, imageData.height);
          resolve(resultado?.data ?? null);
        } catch (e) {
          reject(e);
        }
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo cargar la imagen.')); };
      img.src = url;
    });
  }
}
