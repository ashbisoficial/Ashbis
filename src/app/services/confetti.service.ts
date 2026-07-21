import { Injectable } from '@angular/core';

interface Particula {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotacion: number;
  velocidadRotacion: number;
  tamano: number;
  color: string;
  forma: 'rect' | 'circulo';
}

const COLORES = ['#8b0808', '#ff5b5b', '#ffd54f', '#2dd36f', '#4fa8ff', '#ffffff'];

/**
 * Efecto de confeti liviano, sin librería externa: un <canvas> a pantalla
 * completa se agrega/anima/saca solo. Pensado para momentos puntuales de
 * celebración (aceptar una adopción/hogar temporal), no para uso constante.
 */
@Injectable({ providedIn: 'root' })
export class ConfettiService {

  lanzar(duracionMs = 2600): void {
    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.inset = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '99999';
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) { canvas.remove(); return; }

    const cantidad = 140;
    const particulas: Particula[] = Array.from({ length: cantidad }, () => ({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.3,
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 3,
      rotacion: Math.random() * 360,
      velocidadRotacion: (Math.random() - 0.5) * 12,
      tamano: 6 + Math.random() * 6,
      color: COLORES[Math.floor(Math.random() * COLORES.length)],
      forma: Math.random() > 0.5 ? 'rect' : 'circulo',
    }));

    const inicio = performance.now();
    let frameId: number;

    const animar = (ahora: number) => {
      const transcurrido = ahora - inicio;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (const p of particulas) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.03; // gravedad leve
        p.rotacion += p.velocidadRotacion;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotacion * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.forma === 'rect') {
          ctx.fillRect(-p.tamano / 2, -p.tamano / 4, p.tamano, p.tamano / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.tamano / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (transcurrido < duracionMs) {
        frameId = requestAnimationFrame(animar);
      } else {
        cancelAnimationFrame(frameId);
        canvas.remove();
      }
    };

    frameId = requestAnimationFrame(animar);
  }
}
