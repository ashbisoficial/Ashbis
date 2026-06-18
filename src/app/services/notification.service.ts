import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

export interface ReminderRequest {
  /** ID numérico único y estable (usar hash de string a número) */
  id: number;
  title: string;
  body: string;
  /** Fecha/hora exacta en la que debe sonar el recordatorio */
  at: Date;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly isNative = Capacitor.isNativePlatform();

  /** Timers activos en memoria, solo para el fallback web (se pierden al cerrar la pestaña) */
  private webTimers = new Map<number, ReturnType<typeof setTimeout>>();

  // ── Permisos ──────────────────────────────────────────────────────────────
  async requestPermission(): Promise<boolean> {
    if (this.isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const res = await LocalNotifications.requestPermissions();
      return res.display === 'granted';
    }

    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    if (Notification.permission === 'denied') return false;

    const result = await Notification.requestPermission();
    return result === 'granted';
  }

  async hasPermission(): Promise<boolean> {
    if (this.isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      const res = await LocalNotifications.checkPermissions();
      return res.display === 'granted';
    }
    return 'Notification' in window && Notification.permission === 'granted';
  }

  // ── Programar un recordatorio ────────────────────────────────────────────
  async schedule(req: ReminderRequest): Promise<void> {
    // No programamos si la fecha ya pasó
    if (req.at.getTime() <= Date.now()) return;

    const granted = await this.hasPermission();
    if (!granted) return; // El componente debe pedir permiso explícitamente antes

    if (this.isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({
        notifications: [{
          id: req.id,
          title: req.title,
          body: req.body,
          schedule: { at: req.at, allowWhileIdle: true },
          smallIcon: 'ic_stat_icon_config_sample'
        }]
      });
      return;
    }

    // ── Fallback web: setTimeout + Notification API ─────────────────────────
    // Limitación real del navegador: esto solo dispara si la pestaña/app
    // sigue abierta en el dispositivo al llegar la hora programada.
    this.cancelWeb(req.id);
    const delayMs = req.at.getTime() - Date.now();
    const MAX_TIMEOUT = 2_147_483_647; // límite de setTimeout en navegadores
    if (delayMs > MAX_TIMEOUT) return; // demasiado lejos en el futuro para web

    const timer = setTimeout(() => {
      try {
        new Notification(req.title, { body: req.body, tag: String(req.id) });
      } catch { /* navegador bloqueó la notificación */ }
      this.webTimers.delete(req.id);
    }, delayMs);

    this.webTimers.set(req.id, timer);
  }

  // ── Cancelar un recordatorio ──────────────────────────────────────────────
  async cancel(id: number): Promise<void> {
    if (this.isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.cancel({ notifications: [{ id }] });
      return;
    }
    this.cancelWeb(id);
  }

  private cancelWeb(id: number): void {
    const existing = this.webTimers.get(id);
    if (existing) {
      clearTimeout(existing);
      this.webTimers.delete(id);
    }
  }

  // ── Utilidad: genera un ID numérico estable a partir de un string ─────────
  // Usamos esto para convertir IDs de Firestore (strings) en IDs numéricos
  // que requiere el plugin de notificaciones nativas.
  hashIdToNumber(input: string): number {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash * 31 + input.charCodeAt(i)) >>> 0; // unsigned 32-bit
    }
    return hash % 2_000_000_000; // dentro del rango seguro de int32
  }

  get isWebFallback(): boolean {
    return !this.isNative;
  }
}
