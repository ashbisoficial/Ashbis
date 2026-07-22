import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SecurityService {

  // ── Rate limit de login (cliente) ─────────────────────────────────────────
  // Nota: esto es defensa en profundidad. La regla real la impone Firebase Auth
  // (bloqueo automático tras intentos fallidos). Este límite evita spam desde
  // la UI antes de llegar a Firebase.
  private readonly LOGIN_WINDOW_MS   = 15 * 60_000; // 15 minutos
  private readonly MAX_LOGIN_ATTEMPTS = 5;

  canAttemptLogin(identifier: string): boolean {
    const key      = this.loginStorageKey(identifier);
    const attempts = this.readAttempts(key);
    const now      = Date.now();
    const valid    = attempts.filter(ts => now - ts < this.LOGIN_WINDOW_MS);
    if (valid.length >= this.MAX_LOGIN_ATTEMPTS) return false;
    valid.push(now);
    this.writeAttempts(key, valid);
    return true;
  }

  resetLoginAttempts(identifier: string): void {
    try { localStorage.removeItem(this.loginStorageKey(identifier)); } catch { /* noop */ }
  }

  isLockedOut(identifier: string): boolean {
    const key      = this.loginStorageKey(identifier);
    const attempts = this.readAttempts(key);
    const now      = Date.now();
    return attempts.filter(ts => now - ts < this.LOGIN_WINDOW_MS).length >= this.MAX_LOGIN_ATTEMPTS;
  }

  lockoutRemainingMs(identifier: string): number {
    const key      = this.loginStorageKey(identifier);
    const attempts = this.readAttempts(key);
    const now      = Date.now();
    const valid    = attempts.filter(ts => now - ts < this.LOGIN_WINDOW_MS);
    if (valid.length < this.MAX_LOGIN_ATTEMPTS) return 0;
    const oldest = Math.min(...valid);
    return Math.max(0, this.LOGIN_WINDOW_MS - (now - oldest));
  }

  // ── Sanitización de texto ─────────────────────────────────────────────────
  sanitizeText(input: unknown, maxLen = 500): string {
    if (typeof input !== 'string') return '';
    return input
      .replace(/<[^>]*>/g, '')           // elimina tags HTML
      .replace(/[<>"'`]/g, '')           // elimina chars peligrosos
      .replace(/javascript:/gi, '')      // elimina javascript:
      .replace(/on\w+\s*=/gi, '')        // elimina event handlers inline
      .replace(/\x00/g, '')              // elimina null bytes
      .trim()
      .slice(0, maxLen);
  }

  sanitizeUrl(input: unknown): string {
    if (typeof input !== 'string') return '';
    const trimmed = input.trim();
    // Solo permite http/https y rutas relativas seguras
    if (!/^(https?:\/\/|\/(?!\/))/.test(trimmed)) return '';
    // Bloquea javascript: y data: en la URL
    if (/^(javascript|data|vbscript):/i.test(trimmed)) return '';
    return trimmed.slice(0, 2000);
  }

  sanitizeNumber(input: unknown, min = 0, max = 999_999): number | null {
    const n = Number(input);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, n));
  }

  sanitizeFirestoreObject<T extends Record<string, any>>(value: T): T {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {} as T;

    const output: Record<string, any> = {};
    for (const [key, val] of Object.entries(value)) {
      // Bloquea claves peligrosas (prototype pollution)
      if (
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype' ||
        key.startsWith('__')
      ) continue;

      if (typeof val === 'string') {
        output[key] = this.sanitizeText(val);
      } else if (typeof val === 'number') {
        output[key] = Number.isFinite(val) ? val : 0;
      } else if (typeof val === 'boolean') {
        output[key] = val;
      } else if (val === null) {
        output[key] = val;
      } else if (val === undefined) {
        // Firestore no acepta `undefined` como valor de campo: se omite
        // la clave por completo en vez de guardarla con ese valor.
        continue;
      } else if (Array.isArray(val)) {
        output[key] = val
          .slice(0, 100)
          .map(item => typeof item === 'string' ? this.sanitizeText(item) : item);
      } else if (typeof val === 'object' && val.constructor !== Object) {
        // Tipos especiales de Firestore (serverTimestamp()/increment()/
        // arrayUnion() como FieldValue, Timestamp, GeoPoint,
        // DocumentReference, etc.): NO son objetos planos, son instancias
        // con su propio constructor. Si se recorren con Object.entries()
        // igual que un objeto común, se reconstruyen como un objeto plano
        // que perdió su tipo especial — Firestore ya no los reconoce (ej.
        // serverTimestamp() roto queda como un campo que nunca resuelve a
        // una fecha real). Se pasan tal cual, sin tocarlos.
        output[key] = val;
      } else if (typeof val === 'object') {
        // Objetos anidados planos: recursión un nivel
        output[key] = this.sanitizeFirestoreObject(val as Record<string, any>);
      }
      // Descarta funciones, Symbols y otros tipos
    }
    return output as T;
  }

  // ── Validadores ──────────────────────────────────────────────────────────
  isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  isValidPhone(phone: string): boolean {
    return /^[+\d\s\-()]{6,20}$/.test(phone.trim());
  }

  isValidUrl(url: string): boolean {
    return /^https?:\/\/[^\s]+$/.test(url.trim());
  }

  /**
   * Valida un archivo antes de subirlo a Storage.
   * Retorna null si es válido, o un mensaje de error si no.
   */
  validateFile(
    file: File,
    opts: { allowedTypes?: string[]; maxMb?: number } = {}
  ): string | null {
    const allowedTypes = opts.allowedTypes ?? ['image/jpeg', 'image/png', 'image/webp'];
    const maxBytes     = (opts.maxMb ?? 10) * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      return `Tipo de archivo no permitido. Se permiten: ${allowedTypes.join(', ')}`;
    }
    if (file.size > maxBytes) {
      return `El archivo supera el tamaño máximo de ${opts.maxMb ?? 10} MB.`;
    }
    if (file.size === 0) {
      return 'El archivo está vacío.';
    }
    return null;
  }

  // ── Privados ──────────────────────────────────────────────────────────────
  private loginStorageKey(identifier: string): string {
    // Usamos un hash simple para no exponer el email en la clave
    return `_la_${btoa(identifier.toLowerCase().trim()).slice(0, 20)}`;
  }

  private readAttempts(key: string): number[] {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter(n => Number.isFinite(n)) : [];
    } catch {
      return [];
    }
  }

  private writeAttempts(key: string, attempts: number[]): void {
    try {
      localStorage.setItem(key, JSON.stringify(attempts));
    } catch { /* storage llena o modo privado */ }
  }
}