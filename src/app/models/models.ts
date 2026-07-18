export namespace Models {

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  export namespace Auth {

    export const PathUsers = 'usuarios';

    /**
     * Rol autodeclarado al crear la cuenta, no verificado. No otorga por sí
     * solo acceso a datos sensibles de otras personas: el refugio solo
     * puede operar mascotas que le pertenecen, y el veterinario necesita
     * además el PIN de cada mascota para tocar su historial médico.
     */
    export type Rol = 'usuario' | 'refugio' | 'veterinario';

    export interface UserProfile {
      uid: string;
      nombre: string;
      apellido: string;
      email: string;
      telefono?: string;
      fechaNacimiento?: string;
      region?: string;
      comuna?: string;
      direccion?: string;
      descripcion?: string;
      foto?: string;
      /** Origen de la foto actual: 'google' (viene de la cuenta de Google) o 'custom' (subida por el usuario). */
      fotoOrigen?: 'google' | 'custom';
      provider?: string;
      /** Fecha ISO de creación de la cuenta, usada para mostrar "Miembro desde". */
      fechaRegistro?: string;
      /** Rol de la cuenta. Si falta, se trata como 'usuario' (cuentas creadas antes de este campo). */
      rol?: Rol;
      /** Solo si rol === 'refugio'. Nombre del refugio/organización. */
      nombreRefugio?: string;
      /** Solo si rol === 'veterinario'. Nombre de la clínica (informativo, no verificado). */
      nombreClinica?: string;
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
      // ── QR Público ──────────────────────────
      qrCarnetToken?: string;
      qrPerdidaToken?: string;

      // Estado
      estado?: 'normal' | 'perdida';

      // Identificación visual
      senasParticulares?: string;

      // Salud crítica
      alergias?: string[];
      enfermedadesCronicas?: string[];
      medicamentosPermanentes?: string[];

      // Rescate
      observacionesRescate?: string;

      // Compatibilidad
      seLlevaConPerros?: boolean;
      seLlevaConGatos?: boolean;
      seLlevaConNinos?: boolean;

      // Riesgo
      esAgresivo?: boolean;

      // Contacto extra
      contactoEmergencia?: string;
      telefonoEmergencia?: string;
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