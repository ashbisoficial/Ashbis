export namespace Models {

  // ─── AUTH ──────────────────────────────────────────────────────────────────
  export namespace Auth {

    export const PathUsers = 'usuarios';

    /**
     * Rol autodeclarado al crear la cuenta, no verificado. No otorga por sí
     * solo acceso a datos sensibles de otras personas: el refugio solo
     * puede operar mascotas que le pertenecen, y el veterinario necesita
     * además el PIN de cada mascota para tocar su historial médico.
     * 'servicio' agrupa negocios que no requieren título profesional
     * (peluquería/estética, guardería/pensión, funeraria) — ver TipoServicio.
     * 'pyme' agrupa marcas o mini-emprendimientos que venden productos para
     * mascotas (ropa, juguetes, accesorios, comida, snacks) — ver TipoPyme.
     * Ninguno de los dos pasa por verificación, a diferencia de refugio/veterinario.
     */
    export type Rol = 'usuario' | 'refugio' | 'veterinario' | 'servicio' | 'pyme';

    /**
     * Sub-tipo de negocio dentro del rol 'veterinario'. Los tres implican
     * práctica médica y piden título/registro profesional para verificarse
     * — lo que no la implica (peluquería/estética) vive en el rol 'servicio'.
     * - 'independiente': un solo veterinario, sin clínica detrás.
     * - 'clinica_pequena': menos de 10 personas.
     * - 'clinica_grande': 15 o más personas, puede declarar especialidades.
     */
    export type TipoNegocioVeterinario =
      | 'independiente' | 'clinica_pequena' | 'clinica_grande';

    /**
     * Sub-tipo de negocio dentro del rol 'servicio'. Ninguno pide título
     * profesional ni pasa por verificación — a diferencia de 'veterinario'.
     */
    export type TipoServicio = 'peluqueria' | 'guarderia' | 'funeraria' | 'hotel' | 'transporte';

    /**
     * Sub-tipo de negocio dentro del rol 'pyme'. Tampoco pide título ni
     * pasa por verificación — es una marca/mini-emprendimiento que vende
     * productos para mascotas, no un servicio de atención.
     */
    export type TipoPyme = 'ropa' | 'juguetes' | 'accesorios' | 'comida' | 'snacks' | 'otro';

    export type ModalidadAtencion = 'presencial' | 'a_domicilio' | 'ambas';

    export interface UserProfile {
      uid: string;
      nombre: string;
      apellido: string;
      email: string;
      /** Teléfono/dirección PERSONAL de quien es dueño de la cuenta (pedidos
       *  al registrarse). Para veterinario/servicio, distintos de
       *  telefonoNegocio/direccionNegocio: quien crea la cuenta a veces no es
       *  quien atiende en el local. */
      telefono?: string;
      /** RUT de la persona dueña de la cuenta (o del veterinario, si
       *  rol === 'veterinario') — lo necesitan los documentos/plantillas de
       *  atención veterinaria (ej. formularios de reembolso de seguros). */
      rut?: string;
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
      /** Solo si rol === 'veterinario'. Nombre de la clínica/veterinaria (informativo, no verificado). */
      nombreClinica?: string;
      /** Solo si rol === 'veterinario'. Ver TipoNegocioVeterinario. */
      tipoNegocioVeterinario?: TipoNegocioVeterinario;
      /** Solo si rol === 'servicio' o 'pyme'. Nombre del negocio (peluquería,
       *  guardería, funeraria, o marca/emprendimiento de productos). */
      nombreNegocio?: string;
      /** Solo si rol === 'servicio'. Ver TipoServicio. */
      tipoServicio?: TipoServicio;
      /** Solo si rol === 'pyme'. Ver TipoPyme. */
      tipoPyme?: TipoPyme;
      /** Veterinario, servicio o pyme: teléfono/dirección DEL NEGOCIO, mostrados
       *  públicamente en el buscador de Ashbis — separados del
       *  teléfono/dirección personal de arriba a propósito (ver ese campo).
       *  Se exige teléfono acá antes de poder pedir la verificación de la
       *  cuenta, para frenar cuentas falsas/spam. */
      telefonoNegocio?: string;
      direccionNegocio?: string;
      /** Solo si rol === 'veterinario' y es una clínica (no independiente):
       *  nombre del veterinario responsable/director técnico,
       *  distinto de quien crea la cuenta (que puede ser un/a administrativo/a). */
      nombreDoctor?: string;
      /** Número de registro/colegio profesional. No aplica a peluquerías. */
      numeroRegistroProfesional?: string;
      /** Certificado de título subido para verificación manual futura (ver `verificado`). */
      tituloUrl?: string;
      /** Solo veterinario: áreas de especialización (antes limitado a
       *  clínicas grandes en el registro; ahora cualquier veterinario lo
       *  puede completar/editar desde su panel). */
      especialidades?: string[];
      /** Solo veterinario: si atiende en el local, a domicilio, o ambas. */
      modalidadAtencion?: ModalidadAtencion;
      /** Solo veterinario: universidad/instituto donde estudió. */
      lugarEstudios?: string;
      /** Solo veterinario: especies que atiende habitualmente (perros,
       *  gatos, exóticos, ganado, etc). */
      especiesAtendidas?: string[];
      /** Solo veterinario: notas prediseñadas para completar más rápido el
       *  historial médico de un paciente. */
      notasPredisenadas?: string[];
      /** Veterinario: logo/timbre/firma para personalizar la atención (por
       *  ejemplo, al imprimir o compartir una ficha). Servicio/pyme: solo
       *  logoUrl, para mostrarse en el buscador de Ashbis. */
      logoUrl?: string;
      timbreUrl?: string;
      firmaUrl?: string;
      /** Veterinario, servicio o pyme: sitio web y redes del negocio, mostrados en
       *  el buscador de Ashbis — Ashbis conecta al dueño con el negocio, el
       *  contacto/agenda se maneja fuera de la app. */
      sitioWeb?: string;
      instagram?: string;
      facebook?: string;
      whatsappNegocio?: string;
      /** Revisión manual del título/registro profesional (veterinario) o del
       *  documento legal (refugio); false hasta que el equipo de Ashbis lo
       *  confirme a mano en Firebase Console. El cliente nunca puede ponerlo
       *  en true directamente — ver la regla de Firestore de "usuarios". */
      verificado?: boolean;
      /** Solo si rol === 'refugio'. Documento legal (personería jurídica,
       *  RUT, certificado de constitución) subido para verificación manual —
       *  mismo criterio que tituloUrl para veterinarios. */
      documentoLegalUrl?: string;
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

    /**
     * Colección top-level `qrCuenta/{token}`, id de documento = token
     * aleatorio. Se genera una vez por cuenta (usuarios/{uid}.qrCuentaToken
     * guarda cuál) y cualquier otra persona logueada puede resolverlo — a
     * diferencia de public_qr (que solo lee su dueño; lo público se sirve
     * vía Cloud Function), acá el propósito ES que un tercero lo escanee
     * para no tener que tipear el email a mano al mandar una transferencia
     * de adopción/hogar temporal. Contiene solo lo que la persona ya
     * comparte igual al mandar esa solicitud (nombre y email).
     */
    export const PathQrCuenta = 'qrCuenta';

    export interface QrCuentaInfo {
      uid: string;
      nombre: string;
      email: string;
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

      /** PIN de 6 dígitos para que un veterinario pida acceso al historial
       *  médico de esta mascota puntual (ver namespace HistorialMedico más
       *  abajo). Lo genera/regenera el dueño o el equipo del refugio desde
       *  la ficha de la mascota. Regenerarlo invalida el PIN anterior para
       *  otorgar accesos NUEVOS, pero no revoca los accesos ya otorgados —
       *  eso se hace aparte, quitando el documento en accesosVeterinario. */
      pinHistorial?: string;
      /** Cuándo se generó/regeneró pinHistorial — la Cloud Function
       *  validarPinVeterinario lo usa para vencer PINs de más de 90 días. */
      pinGeneradoEn?: any;
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
      /**
       * Id y nombre de la mascota duplicados dentro del propio documento
       * (además de estar implícitos en la ruta mascotas/{mascotaId}/...) por
       * el mismo motivo que MiembroEquipo duplica refugioUid: permite
       * resolver collectionGroup('colaboradores').where('uid','==', uid) a
       * mascotas concretas sin conocer antes su id.
       */
      mascotaId: string;
      mascotaNombre: string;
    }

    /**
     * Subcolección mascotas/{id}/accesosVeterinario: acceso de UN
     * veterinario puntual al historial médico de esta mascota, otorgado al
     * validar su PIN (ver Cloud Function validarPinVeterinario). Da acceso
     * de solo lectura a la ficha y a vacunas/exámenes/medicamentos/citas, y
     * de escritura (append-only) a historialMedico — nunca a editar o
     * borrar nada.
     */
    export interface AccesoVeterinario {
      vetUid: string;
      vetNombre: string;
      vetEmail: string;
      nombreClinica?: string;
      otorgadoEn?: any;
      /**
       * Id y nombre duplicados dentro del propio documento, mismo motivo que
       * ColaboradorMascota: permite resolver
       * collectionGroup('accesosVeterinario').where('vetUid','==', uid) a
       * "mis pacientes" sin conocer antes el id de cada mascota.
       */
      mascotaId: string;
      mascotaNombre: string;
    }
  }

  // ─── HISTORIAL MÉDICO (notas de consulta, append-only) ─────────────────────
  export namespace HistorialMedico {
    export const PathEntradas = 'historialMedico'; // subcolección de mascotas/{id}

    /**
     * Nota de consulta agregada por el dueño/equipo o por un veterinario con
     * acceso otorgado por PIN (ver Mascotas.AccesoVeterinario). Append-only:
     * no se puede editar ni borrar, mismo criterio que ChatEquipo — así ni
     * el dueño ni el veterinario pueden alterar el registro después de
     * escrito.
     */
    /** Clasifica la entrada para mostrarla como una orden clínica (ver
     *  mascota-detalle) — puramente de presentación, no cambia qué campos
     *  se guardan ni la validación en firestore.rules (ya acepta 'tipo'
     *  como string genérico). */
    export type TipoEntrada = 'consulta' | 'receta' | 'vacunacion' | 'examen' | 'cirugia' | 'otro';

    export interface Entrada {
      id?: string;
      /** Default 'consulta' para las entradas viejas que no lo tenían. */
      tipo?: TipoEntrada;
      /** Motivo de la consulta (ej. "control anual", "vómitos hace 2 días"). */
      motivo?: string;
      /** Diagnóstico del profesional que atendió. */
      diagnostico?: string;
      /** Tratamiento indicado: procedimientos, exámenes solicitados, medicación, etc. */
      tratamiento?: string;
      /** Observación libre adicional — antes era el único campo de esta
       *  entrada; se mantiene para notas rápidas o info que no encaja en
       *  motivo/diagnóstico/tratamiento. Al menos uno de los 4 campos debe
       *  venir completo (ver validación en firestore.rules). */
      texto?: string;
      /** Orden clínica en PDF (datos de la mascota + del veterinario/clínica
       *  + su logo/timbre/firma) generada al cargar la entrada — solo cuando
       *  la carga un veterinario (ver mascota-detalle). Va SIEMPRE en el
       *  create original: la entrada es append-only, así que no hay forma
       *  de agregarlo después con un update. */
      pdfUrl?: string;
      autorUid: string;
      autorNombre: string;
      autorRol: Auth.Rol;
      createdAt?: any;
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
      /** Región/comuna de quien publica (tomadas de su perfil), para dar una
       *  referencia de ubicación sin exponer la dirección exacta. */
      region?: string;
      comuna?: string;
      tipo: TipoPublicacion;
      titulo: string;
      descripcion: string;
      fotoUrl?: string;
      /** Opcional: vincula la publicación a una ficha de mascota ya creada. */
      mascotaId?: string;
      /** Info pública de la mascota vinculada (solo para tipo='adopcion'),
       *  copiada de mascotas/{mascotaId} al publicar y resincronizada por la
       *  Cloud Function onMascotaActualizada cada vez que el dueño edita la
       *  ficha. Necesario porque mascotas/{id} NO es legible por cualquiera
       *  (tiene datos privados) — esta es la única fuente de esos datos que
       *  puede ver alguien que no sea el dueño/equipo. */
      especie?: string;
      raza?: string;
      sexo?: string;
      edad?: number;
      color?: string;
      castrado?: 'Sí' | 'No';
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

  // ─── POSTULACIONES DE ADOPCIÓN ──────────────────────────────────────────────
  export namespace Postulaciones {
    export const PathPostulaciones = 'postulaciones';

    export type EstadoPostulacion = 'pendiente' | 'aceptada' | 'rechazada' | 'cancelada';

    /**
     * Cualquier usuario postula a adoptar una mascota desde su publicación
     * (tipo 'adopcion'). El refugio ve todas las postulaciones pendientes y
     * elige con quién seguir la conversación. Aceptar una postulación NO
     * transfiere la mascota — solo abre un ChatDirecto para coordinar; el
     * traspaso real de dueño sigue pasando por Transferencias, como ya
     * funciona hoy (el refugio la manda desde el chat una vez que se
     * pusieron de acuerdo).
     */
    export interface Postulacion {
      id?: string;
      publicacionId: string;
      mascotaId?: string;
      mascotaNombre: string;
      refugioUid: string;
      postulanteUid: string;
      postulanteNombre: string;
      postulanteEmail: string;
      mensaje?: string;
      estado: EstadoPostulacion;
      createdAt?: any;
      resueltaEn?: any;
    }
  }

  // ─── CHAT DIRECTO (usuario ↔ refugio, por una postulación aceptada) ────────
  export namespace ChatDirecto {
    export const PathChats = 'chatsDirectos'; // colección top-level
    export const PathMensajes = 'mensajes'; // subcolección de chatsDirectos/{id}

    /**
     * Se crea al aceptar una Postulacion, con el mismo id que ella (así no
     * hace falta buscarlo aparte). Mensajes append-only, mismo criterio que
     * ChatEquipo.
     */
    export interface Chat {
      id?: string;
      participantes: string[]; // [refugioUid, postulanteUid]
      mascotaId?: string;
      mascotaNombre: string;
      refugioUid: string;
      refugioNombre: string;
      postulanteUid: string;
      postulanteNombre: string;
      /** Para poder iniciar la transferencia de la mascota sin salir del chat. */
      postulanteEmail: string;
      postulacionId: string;
      createdAt?: any;
    }

    export interface Mensaje {
      id?: string;
      texto: string;
      autorUid: string;
      autorNombre: string;
      createdAt?: any;
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

  // ─── FINANZAS DEL REFUGIO (bitácora interna, no procesa pagos) ─────────────
  export namespace Finanzas {
    export const PathMovimientos = 'movimientosFinancieros'; // subcolección de usuarios/{refugioUid}

    export type TipoMovimiento = 'ingreso' | 'gasto';

    export type CategoriaMovimiento =
      | 'alimentacion' | 'veterinaria' | 'medicamentos' | 'insumos'
      | 'donacion' | 'adopcion' | 'eventos' | 'transporte' | 'otro';

    /**
     * Registro manual de un ingreso o gasto del refugio. Es solo una
     * bitácora interna para llevar cuentas — Ashbis no procesa, retiene ni
     * transfiere dinero entre personas (ver sección 8 de los Términos).
     */
    export interface Movimiento {
      id?: string;
      tipo: TipoMovimiento;
      monto: number;
      categoria: CategoriaMovimiento;
      descripcion?: string;
      /** Opcional: vincula el movimiento a una mascota puntual (ej. gasto veterinario de una mascota). */
      mascotaId?: string;
      mascotaNombre?: string;
      /** Fecha del movimiento (no de carga), formato ISO yyyy-mm-dd. */
      fecha: string;
      creadoPor: string;
      createdAt?: any;
    }
  }

  // ─── INFO PÚBLICA DE REFUGIO (antifraude: verificación + recaudación) ──────
  export namespace RefugiosPublico {
    /** Colección top-level, id de documento = uid del refugio. La mantienen
     *  al día únicamente Cloud Functions (Admin SDK) a partir de
     *  usuarios/{uid} y usuarios/{uid}/movimientosFinancieros — el cliente
     *  nunca escribe acá directo. Solo trae los campos que tiene sentido que
     *  vea cualquier persona antes de postular a una adopción o donar,
     *  separados del resto del perfil (email, teléfono, dirección) que
     *  sigue siendo privado. */
    export const PathRefugiosPublico = 'refugiosPublico';

    export interface InfoPublicaRefugio {
      nombreRefugio: string;
      verificado: boolean;
      /** Suma de los movimientos tipo 'ingreso' categoría 'donacion' que el
       *  refugio cargó en su bitácora financiera — declarado por el propio
       *  refugio, no verificado por Ashbis; se muestra igual con esa
       *  salvedad para dar transparencia antes de donar. */
      totalDonacionesDeclaradas: number;
    }
  }

  // ─── BUSCADOR (directorio público de veterinarios y servicios) ─────────────
  export namespace DirectorioPublico {
    /** Colección top-level, id de documento = uid de la cuenta. Mismo
     *  criterio que RefugiosPublico (la mantiene al día únicamente
     *  onUsuarioActualizado con Admin SDK, nunca el cliente): solo trae
     *  datos "de negocio" ya pensados como públicos desde antes (ver
     *  comentarios de telefonoNegocio/direccionNegocio/logoUrl en
     *  Auth.UserProfile) — nunca email, teléfono/dirección personal, ni
     *  documentos de verificación (tituloUrl/documentoLegalUrl). Cubre
     *  'veterinario', 'servicio' y 'pyme' — refugio sigue usando RefugiosPublico,
     *  que ya existía antes y no hacía falta migrar. */
    export const PathDirectorioPublico = 'directorioPublico';

    export interface EntradaDirectorio {
      uid: string;
      rol: 'veterinario' | 'servicio' | 'pyme';
      nombre: string; // nombreClinica o nombreNegocio
      tipo?: string; // tipoNegocioVeterinario, tipoServicio o tipoPyme
      modalidadAtencion?: Auth.ModalidadAtencion;
      especialidades?: string[];
      especiesAtendidas?: string[];
      lugarEstudios?: string;
      direccionNegocio?: string;
      telefonoNegocio?: string;
      descripcion?: string;
      sitioWeb?: string;
      instagram?: string;
      facebook?: string;
      whatsappNegocio?: string;
      logoUrl?: string;
      /** Solo aplica a veterinario — servicio no pasa por verificación. */
      verificado?: boolean;
      region?: string;
      comuna?: string;
    }
  }

  // ─── CHAT DE EQUIPO DEL REFUGIO ─────────────────────────────────────────────
  export namespace ChatEquipo {
    export const PathMensajes = 'chatEquipo'; // subcolección de usuarios/{refugioUid}

    /**
     * Un solo hilo grupal por refugio (dueño + todo el equipo). Los mensajes
     * son append-only: no se pueden editar ni borrar, igual criterio que el
     * historial médico — simplifica las reglas y evita disputas sobre
     * ediciones.
     */
    export interface Mensaje {
      id?: string;
      texto: string;
      autorUid: string;
      autorNombre: string;
      createdAt?: any;
    }
  }
}