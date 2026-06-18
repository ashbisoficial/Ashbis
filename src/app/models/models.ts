export namespace Models {

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  export namespace Auth {

    export const PathUsers = 'usuarios';

    export interface UserProfile {
      uid: string;
      nombre: string;
      apellido: string;
      email: string;
      telefono?: string;
      region?: string;
      direccion?: string;
      foto?: string;
      provider?: string;
    }
  }

  // ─── MASCOTAS ──────────────────────────────────────────────────────────────
  export namespace Mascotas {
    export const PathMascotas = 'mascotas';

    export interface Mascota {
      id: string;
      uidUsuario: string;
      nombre: string;
      edad?: number;
      sexo: string;
      fechaNacimiento?: string;
      especie: string;
      color?: string;
      raza: string;
      castrado?: 'Sí' | 'No';
      fechaRegistro?: string;
      date?: any;
      fotoUrl?: string;
      galeria?: string[];
      // Campos extendidos
      peso?: number;           // en kg
      numeroChip?: string;
      indicadores?: string[];  // cuidados especiales: 'Alérgico', 'Agresivo', etc.
    }

    // Subcoleción: vacunas
    export interface Vacuna {
      id?: string;
      tipo: string;
      fechaAplicacion: string;
      proximaFecha?: string;
      notas?: string;
      creadoPor: string;
    }

    // Subcoleción: exámenes
    export interface Examen {
      id?: string;
      tipo: string;
      fechaProgramada?: string;
      realizado?: boolean;
      fechaRealizado?: string;
      lugar?: string;
      costo?: number;
      notas?: string;
      ordenUrl?: string;
      resultadoUrl?: string;
      creadoPor: string;
    }

    // Subcoleción: medicamentos
    export interface Medicamento {
      id?: string;
      nombre: string;
      mg: number;
      fechaInicio: string;
      fechaFin?: string;
      costo?: number;
      notas?: string;
      creadoPor: string;
    }

    // Subcoleción: citas
    export interface Cita {
      id?: string;
      titulo: string;
      fechaInicio: string;
      fechaFin?: string;
      lugar?: string;
      notas?: string;
      creadoPor: string;
    }
  }

  // ─── VETERINARIAS FAVORITAS ────────────────────────────────────────────────
  export namespace Veterinarias {
    export interface VeterinariaFavorita {
      id?: string;
      placeId: string;
      nombre: string;
      direccion: string;
      lat: number;
      lng: number;
      rating?: number;
      tipos?: string[];
      uidUsuario: string;
      fechaRegistro?: string;
    }
  }
}