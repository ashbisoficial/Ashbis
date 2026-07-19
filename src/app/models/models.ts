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
      /** Hasta 2 contactos adicionales de emergencia. Se exponen en el
       *  carnet público de una mascota en las mismas condiciones que el
       *  teléfono del dueño (siempre en el carnet médico; en el QR de
       *  "mascota perdida" solo mientras esté marcada como perdida). */
      contactosEmergencia?: ContactoEmergencia[];
    }

    export interface ContactoEmergencia {
      nombre: string;
      telefono: string;
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

    /**
     * Subcolección mascotas/{id}/colaboradores: acceso compartido al perfil
     * de una mascota puntual sin cambiar de dueño (hogar temporal). Se crea
     * al aceptar una Transferencia de tipo 'hogar_temporal'.
     */
    export interface ColaboradorMascota {
      uid: string;
      nombre: string;
      email: string;
      tipo: 'hogar_temporal';
      agregadoEn?: any;
    }
  }

  // ─── TRANSFERENCIAS DE DUEÑO (adopción) Y HOGAR TEMPORAL ───────────────────
  export namespace Transferencias {
    export const PathTransferencias = 'transferencias';

    export type EstadoTransferencia = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';

    /**
     * 'adopcion': se entrega la mascota por completo — al aceptar, cambia
     * mascotas/{id}.uidUsuario al nuevo dueño (con todo su historial).
     * 'hogar_temporal': acceso compartido, NO cambia de dueño — al aceptar,
     * se agrega a quien acepta como colaborador en
     * mascotas/{id}/colaboradores/{uid}, y el refugio sigue siendo el dueño
     * legal. Pensado para hogares temporales o foster.
     */
    export type TipoTransferencia = 'adopcion' | 'hogar_temporal';

    /**
     * Solicitud de cambio de dueño o de acceso compartido de una mascota,
     * iniciada por quien la tiene hoy (típicamente un refugio). Solo se
     * concreta cuando el destinatario la acepta — nunca de forma unilateral.
     */
    export interface Transferencia {
      id?: string;
      tipo: TipoTransferencia;
      mascotaId: string;
      mascotaNombre: string;
      deUid: string;
      deNombre: string;
      /** Email de quien recibe la mascota/acceso. Así se puede invitar sin conocer el uid de antemano. */
      paraEmail: string;
      /** Se completa recién cuando la transferencia se acepta. */
      paraUid?: string;
      estado: EstadoTransferencia;
      mensaje?: string;
      createdAt?: any;
      resueltaEn?: any;
    }
  }

  // ─── EQUIPO DE REFUGIO (varias personas operando la misma cuenta) ──────────
  export namespace Equipo {
    export const PathInvitaciones = 'invitacionesEquipo';
    export const PathMiembros = 'miembros'; // subcolección de usuarios/{refugioUid}/miembros

    export type RolEquipo = 'admin' | 'staff';
    export type EstadoInvitacion = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';

    /**
     * Documento en usuarios/{refugioUid}/miembros/{uid}. refugioUid va
     * duplicado dentro del propio documento (además de estar en la ruta)
     * para poder hacer un collectionGroup('miembros').where('uid','==', mi
     * uid) y saber de qué refugios soy miembro sin conocer antes el uid del
     * refugio.
     */
    export interface MiembroEquipo {
      uid: string;
      refugioUid: string;
      nombre: string;
      email: string;
      rolEquipo: RolEquipo;
      agregadoEn?: any;
    }

    /**
     * Invitación a sumarse al equipo de un refugio. El refugio (dueño
     * original o un admin del equipo) invita por email; la persona pasa a
     * operar la cuenta del refugio recién cuando acepta desde su perfil.
     * Aceptar lo resuelve la Cloud Function aceptarInvitacionEquipo, que
     * crea el documento en usuarios/{refugioUid}/miembros/{uid}.
     */
    export interface InvitacionEquipo {
      id?: string;
      refugioUid: string;
      refugioNombre: string;
      paraEmail: string;
      rolEquipo: RolEquipo;
      estado: EstadoInvitacion;
      createdAt?: any;
      resueltaEn?: any;
    }
  }

  // ─── PUBLICACIONES (adopción / recolección / donaciones) ───────────────────
  export namespace Publicaciones {
    export const PathPublicaciones = 'publicaciones';

    export type TipoPublicacion = 'adopcion' | 'recoleccion' | 'donacion' | 'otro';

    export interface Publicacion {
      id?: string;
      uidAutor: string;
      nombreAutor: string;
      tipo: TipoPublicacion;
      titulo: string;
      descripcion: string;
      fotoUrl?: string;
      /** Opcional: vincula la publicación a una ficha de mascota ya creada. */
      mascotaId?: string;
      activa: boolean;
      createdAt?: any;
      updatedAt?: any;
      /** Se calcula al crear (createdAt + 30 días); habilita el borrado
       *  automático vía política de TTL de Firestore sobre este campo. */
      expiraEn?: any;
      /** Debe ser true: quien publica confirma que los datos son reales y
       *  acepta responsabilidad legal en caso de estafa/fraude/difamación. */
      aceptaVeracidad: boolean;
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