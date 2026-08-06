# Manual funcional de Ashbis — documentación para bot de soporte

> Documento de referencia interna. Describe cómo funciona la app Ashbis (Ionic + Angular standalone + Capacitor + Firebase) desde la perspectiva de qué ve y qué puede hacer cada usuario, más los detalles técnicos (colecciones de Firestore, reglas, Cloud Functions) necesarios para responder dudas de soporte con precisión. Generado a partir de una revisión exhaustiva del código fuente en agosto de 2026.

## Historial de cambios de este manual

Registro de qué se modificó, agregó o sacó del manual, con fecha y motivo — para tener trazabilidad de cómo fue evolucionando la app desde que existe este documento. Orden: más reciente primero. Los cambios de la app anteriores a la primera fecha registrada acá no quedaron documentados de forma individual (el manual original de agosto de 2026 se armó de una sola vez, a partir de una revisión completa del código en ese momento).

| Fecha | Cambio | Motivo |
|---|---|---|
| 2026-08-05 | **Auditoría completa de español neutral**: se revisó todo `src/app/**` (plantillas y código) buscando voseo rioplatense (vos/tenés/podés/tocá/elegí/etc.) y se corrigió en 32 archivos (~80 instancias) a español neutral (tú). Incluye texto que yo mismo había introducido sin darme cuenta al agregar la cuenta Pyme ("Qué vendés"). También se corrigió la cita textual de este manual en la sección 20. | Pedido explícito de revisar toda la app, no solo una pantalla puntual — hasta ahora las correcciones habían sido parche por parche. |
| 2026-08-05 | Se rediseñó el **registro** (`/registro` y `/completar-perfil`): el selector de tipo de cuenta pasó de tabs de texto subrayado a tarjetas con ícono en grilla; los campos pasaron del estilo "subrayado forzado" a tarjetas "surface" (mismo lenguaje visual que veterinario-panel/mascota-detalle/buscador); se corrigió que el botón "Atrás"/"Volver a Ingresar" (`color="medium"`) salía rojo sólido, idéntico al botón primario, sin ninguna jerarquía visual entre ambos; se consolidaron los colores rojo dispersos (`#ff3b3b`, `#d30000`, `#8b0808`) en una sola variable. | Pedido explícito de mejorar el diseño general del registro. |
| 2026-08-05 | Se agregó un **algoritmo de recomendación** en la pestaña "Todos" del Buscador: reordena los resultados priorizando veterinarios que atienden la especie de alguna mascota propia de quien busca (+5), negocios en su misma comuna (+2) o región (+1), y veterinarios verificados (+1). Sin sesión, sin mascotas o sin región/comuna cargada, el orden queda igual que antes (sin romper nada). Marca con un badge "Recomendado" las entradas con puntaje mayor a cero. Solo aplica en "Todos" — dentro de una categoría ya elegida no reordena. | Pedido explícito de que el Buscador recomiende según el tipo de mascota del usuario. |
| 2026-08-05 | Se agregó el **rol de cuenta `pyme`** (marcas/mini-emprendimientos que venden productos para mascotas: ropa, juguetes, accesorios, comida, snacks) — quinto tipo de cuenta, con su propio paso de registro, panel (`/tabs/pyme-panel`), pestaña y sincronización al directorio público. No pasa por verificación, mismo criterio que `servicio`. | Pedido explícito de sumar un tipo de cuenta para pequeños negocios de productos, distinto de `servicio` (que son negocios de atención: peluquería, guardería, funeraria). |
| 2026-08-05 | Se agregaron **"Hotel para mascotas" y "Transporte de mascotas"** como nuevos `tipoServicio`. | Necesarios para que las subopciones nuevas del buscador (ver abajo) tuvieran datos reales detrás. |
| 2026-08-05 | Se rediseñó el **Buscador**: categorías (Todos/Veterinarios/Servicios/Pymes) apiladas verticalmente con ícono, en vez del selector `ion-segment` horizontal de antes; y al elegir una categoría aparecen subopciones (especialidad para veterinarios, tipo de negocio para servicios/pymes) para filtrar más fino. | Pedido explícito de mejorar la navegación del buscador con drill-down por categoría. |
| 2026-08-04 | Se agregó el sistema de **tipo de orden clínica** en el historial médico (Consulta general, Receta médica, Vacunación/desparasitación, Examen/imagenología, Cirugía, Otro), que cambia las etiquetas de los campos existentes según el tipo elegido — ver sección 9. | Reflejar en la app el formato de las órdenes clínicas profesionales que usa un veterinario en papel (recetas, órdenes de examen, etc.), en vez de una única nota de texto libre sin clasificar. |
| 2026-08-04 | Se agregó la **generación automática de PDF** de la orden clínica cuando la carga un veterinario (datos de la clínica, del paciente, de la orden, y logo/firma/timbre del profesional) — ver sección 9. | Dar al veterinario un documento descargable con la misma información de la orden, listo para entregar o archivar, sin depender de un sistema externo. |
| 2026-08-04 | Las cuentas `veterinario` **ya no pueden tener mascotas propias**: se ocultó la pestaña "Mis Mascotas" para ese rol y se bloqueó por ruta el acceso directo a `/tabs/listar-mascotas` y `/tabs/crear-mascotas` — ver secciones 1, 15 y 23. | Separar con claridad el rol profesional (acceso a pacientes ajenos por ID + PIN) del rol de dueño de mascota; antes nada lo impedía. |
| 2026-08-04 | Se convirtió a español neutral el texto de la Guía de uso in-app (`/tabs/guia`), que estaba enteramente en voseo. | Consistencia de idioma en toda la app: el español neutral es el estándar del proyecto. |

## Índice

1. [Conceptos generales](#1-conceptos-generales)
2. [Registro de cuenta y onboarding](#2-registro-de-cuenta-y-onboarding)
3. [Autenticación](#3-autenticación)
4. [Perfil de usuario y Configuración](#4-perfil-de-usuario-y-configuración)
5. [Mascotas — ficha y datos](#5-mascotas--ficha-y-datos)
6. [Crear y editar una mascota](#6-crear-y-editar-una-mascota)
7. [Carnet digital / QR público](#7-carnet-digital--qr-público)
8. [Mascota perdida](#8-mascota-perdida)
9. [Historial médico y PIN veterinario](#9-historial-médico-y-pin-veterinario)
10. [Transferencias: adopción y hogar temporal](#10-transferencias-adopción-y-hogar-temporal)
11. [Panel de Refugio](#11-panel-de-refugio)
12. [Finanzas del refugio](#12-finanzas-del-refugio)
13. [Publicaciones (adopción / recolección / donación)](#13-publicaciones-adopción--recolección--donación)
14. [Chats](#14-chats)
15. [Panel de Veterinario](#15-panel-de-veterinario)
16. [Panel de Servicio, Panel de Pyme y Buscador](#16-panel-de-servicio-panel-de-pyme-y-buscador)
17. [Panel de administración de Ashbis](#17-panel-de-administración-de-ashbis)
18. [Home / feed principal](#18-home--feed-principal)
19. [Notificaciones](#19-notificaciones)
20. [Chat con IA](#20-chat-con-ia)
21. [Seguridad y privacidad](#21-seguridad-y-privacidad)
22. [Guía de uso dentro de la app](#22-guía-de-uso-dentro-de-la-app)
23. [Mapa de rutas](#23-mapa-de-rutas)
24. [Limitaciones y huecos conocidos](#24-limitaciones-y-huecos-conocidos)

---

## 1. Conceptos generales

Ashbis es una app para dueños de mascotas, refugios, veterinarios y negocios para mascotas (servicios de atención y pymes de productos). Cinco tipos de cuenta (**rol**), elegido una única vez al crear la cuenta y **nunca modificable después**:

| Rol | Quién lo usa | Necesita verificación |
|---|---|---|
| `usuario` | Dueño/a de mascota común | No |
| `refugio` | Refugios/organizaciones de rescate | Sí (documento legal) |
| `veterinario` | Veterinarios/as y clínicas | Sí (título profesional) |
| `servicio` | Peluquería/estética, guardería/pensión, funeraria, hotel, transporte | No |
| `pyme` | Marcas/mini-emprendimientos que venden productos: ropa, juguetes, accesorios, comida, snacks | No |

El rol es **autodeclarado**: nadie lo verifica al momento de elegirlo. Lo que sí se verifica después (para refugio y veterinario) es la documentación de respaldo, de forma manual por el equipo de Ashbis.

Dentro de `veterinario` hay un sub-tipo `tipoNegocioVeterinario`: `independiente | clinica_pequena | clinica_grande` — los tres implican práctica médica y piden verificación. Dentro de `servicio`, el sub-tipo `tipoServicio`: `peluqueria | guarderia | funeraria | hotel | transporte`. Dentro de `pyme`, el sub-tipo `tipoPyme`: `ropa | juguetes | accesorios | comida | snacks | otro`. Ninguno de estos dos últimos roles pide título ni pasa por verificación.

**Navegación principal**: tab bar inferior con Home, Perfil y Buscador siempre visibles, más una pestaña extra según el rol/contexto: "Refugio" (si es dueño/a o colaborador de al menos un refugio), "Veterinario" (si `rol === 'veterinario'`), "Servicio" (si `rol === 'servicio'`), "Pyme" (si `rol === 'pyme'`). **"Mis Mascotas" se muestra para todos los roles excepto `veterinario`** — una cuenta veterinaria no tiene mascotas propias, accede a pacientes ajenos por ID + PIN (ver secciones 9 y 15).

---

## 2. Registro de cuenta y onboarding

*(Nota: este flujo fue rediseñado en agosto de 2026 — antes era un único formulario largo con scroll infinito y pedía la dirección exacta de forma obligatoria.)*

### Registro con email y contraseña (`/registro`)

Formulario **en pasos**, con barra de progreso ("Paso X de Y — [nombre del paso]"):

1. **Tipo de cuenta**: elegir entre Dueño / Refugio / Veterinario / Servicio (tabs, no un select).
2. **Datos de tu cuenta** (se salta automáticamente para "Dueño", que no tiene campos propios):
   - Refugio: nombre del refugio/organización (obligatorio).
   - Veterinario: tipo de cuenta veterinaria (independiente/clínica chica/clínica grande, obligatorio), nombre de la clínica o consulta (opcional), nombre del veterinario/a responsable (obligatorio solo si es clínica, no si es independiente), número de registro/colegio profesional (obligatorio), especialidades separadas por coma (opcional, solo visible en clínica grande), modalidad de atención — en el local / a domicilio / ambas (obligatorio), y subir título o certificado profesional (obligatorio, JPEG/PNG/WEBP/PDF, máx. 15 MB).
   - Servicio: tipo de servicio — peluquería/estética, guardería/pensión, funeraria (obligatorio) y nombre del negocio (obligatorio). No pide título.
3. **Datos personales**: nombre, apellido, teléfono (formato chileno `+569XXXXXXXX`), **región y comuna** (selects dependientes: primero región, la lista de comunas se filtra según la región elegida).
4. **Credenciales**: email, contraseña (mínimo 8 caracteres, con mayúscula+minúscula+número+símbolo — medidor de fuerza visual), confirmar contraseña, checkbox obligatorio de aceptar Términos y Privacidad (se pueden leer sin salir del registro, en un modal).

**La dirección exacta (calle/número) ya NO se pide en el registro.** Es un dato opcional que se agrega después, desde Perfil, si la persona quiere.

Botones "Atrás"/"Siguiente" entre pasos; el botón final ("Crear cuenta") solo aparece en el último paso. Cada paso valida sus propios campos antes de dejar avanzar.

Al enviar: se crea el usuario en Firebase Auth, se sube el título si corresponde, se crea el documento `usuarios/{uid}` (con `verificado: false` si es veterinario, `consentGiven: true`, `consentVersion: '2.0'`), y navega a `/bienvenida`.

### Registro con Google, primera vez (`/completar-perfil`)

Google no tiene selector de tipo de cuenta, así que a quien se loguea con Google por primera vez le falta elegir el rol. Mismo estilo en pasos, pero sin nombre/apellido/email/foto (ya vienen de Google) ni contraseña:
1. Tipo de cuenta.
2. Datos de tu cuenta (igual que arriba, se salta para Dueño).
3. Datos personales (teléfono, región/comuna) + checkbox de Términos y Privacidad.

Si alguien cierra la app justo después de loguearse con Google pero antes de terminar este paso, al volver a abrir la app el guard `perfilCompletoGuard` lo manda de nuevo a `/completar-perfil` en vez de dejarlo entrar a medias.

### Pantalla de Bienvenida (`/bienvenida`)

Se muestra **una sola vez**, justo después de crear la cuenta (por cualquiera de los dos caminos), antes de entrar a `/tabs/home`. Pregunta preferencias, todas opcionales — un botón "Continuar" siempre avanza:
- **Apariencia**: tema oscuro/claro, tamaño de letra (4 niveles).
- **Notificaciones**: activar push (dispara el permiso real del navegador/SO en el momento).
- **Cámara y ubicación**: dos interruptores propios de Ashbis (no el permiso real del sistema) — al activarlos también disparan el permiso real una vez.

Todo esto se puede volver a cambiar después desde Configuración.

---

## 3. Autenticación

**Métodos de login:**
- Email + contraseña (Firebase Auth estándar).
- Google en la web: Google Identity Services (ventana emergente propia, no popup/redirect de Firebase — se eligió así porque el flujo con iframe fallaba con `auth/internal-error` cuando el navegador bloquea cookies de terceros).
- Google en la app nativa (Android): `@southdevs/capacitor-google-auth`, selector nativo del sistema.
- Recuperar contraseña: `/forgot-password` o desde Configuración → "Cambiar contraseña" — ambos mandan un correo de reseteo. Por seguridad, el mensaje es el mismo exista o no esa cuenta ("Si el correo existe, recibirá instrucciones").

**Flujo completo desde abrir la app sin sesión:**
- Ruta raíz `/` y cualquier ruta no reconocida → `/login`.
- Registro nuevo (email o Google) → `/bienvenida` → `/tabs/home`.
- Login con cuenta ya existente → directo a `/tabs/home`.

**Guards:**
- `publicGuard` (en `/login`, `/registro`, `/forgot-password`): si ya hay sesión, redirige a `/tabs/home`.
- `authGuard` (en `/completar-perfil`, `/bienvenida`, y primer guard de `/tabs`): exige sesión.
- `perfilCompletoGuard` (en `/tabs`): si está logueado pero no existe `usuarios/{uid}` todavía, redirige a `/completar-perfil`.
- `adminGuard` (en `/tabs/admin-veterinarios`): solo la cuenta `ashbis.oficial@gmail.com`.

Rate-limit del lado del cliente: máximo 5 intentos de login por email cada 15 minutos (defensa adicional, el bloqueo real lo hace Firebase Auth).

---

## 4. Perfil de usuario y Configuración

### Perfil (`/tabs/perfil`)

Campos editables: nombre, apellido, email (no editable), teléfono, fecha de nacimiento, **región/comuna** (selects dependientes), **dirección** (opcional, texto libre — este es el lugar para cargarla si no se hizo en el registro), descripción (máx. 300 caracteres), foto de perfil, y **hasta 2 contactos de emergencia** (nombre + teléfono cada uno).

- Si la cuenta es de Google y todavía no se subió una foto propia, se puede "usar la foto de Google"; al subir una propia queda marcada como personalizada y ya no se pisa en logins futuros.
- Al guardar, además de `usuarios/{uid}`, se actualiza `usuarios/{uid}/publico/contacto` — una copia reducida (nombre/apellido/teléfono/contactos de emergencia) que es la que consume el carnet público y la ficha de mascota perdida. **El email, la dirección y la fecha de nacimiento reales nunca se exponen ahí.**
- **"Mi QR"**: código QR único de la cuenta (para que otra persona lo escanee al recibir una transferencia/adopción, sin tener que tipear el email).
- Muestra transferencias e invitaciones de equipo pendientes, y los refugios ajenos en los que colabora (solo lectura de nombres; salir del equipo se hace desde Configuración).
- Si el email logueado es `ashbis.oficial@gmail.com`, aparece acceso al Panel de administración.

### Configuración (`/tabs/configuracion`)

- **Apariencia**: tema claro/oscuro (por defecto oscuro) y tamaño de letra (pequeño/normal/grande/muy grande) — persistidos en el dispositivo.
- **Notificaciones push**: activar/desactivar, mostrando el estado real del permiso (concedido/denegado/no pedido/no soportado). Aviso especial para Safari en iPhone/iPad si el sitio no está agregado a la pantalla de inicio (ahí Safari no soporta push).
- **Cámara / Ubicación**: dos interruptores propios de Ashbis (no el permiso real del sistema, que nunca se puede revocar por código) — si están apagados, la app no llama a esas funciones aunque el permiso del navegador siga concedido.
- **Cambiar contraseña**: manda el correo de reseteo.
- **Equipos en los que colabora**: refugios ajenos con botón "Salir del equipo".
- **Cerrar sesión**.
- **Eliminar cuenta** (irreversible, con confirmación): ver detalle abajo.

### Eliminar cuenta — qué borra exactamente

1. Por cada mascota del usuario: subcolecciones (vacunas, medicamentos, exámenes, citas, documentos), archivos de Storage de esa mascota, tokens QR asociados, y el documento de la mascota.
2. Archivos de Storage de la cuenta (foto, título de veterinario, documento legal), el contacto público, veterinarias favoritas, tokens de notificación push, y el documento `usuarios/{uid}`.
3. La cuenta de Firebase Authentication.

**No borra** (quedan huérfanos, referenciando un uid que ya no existe): mensajes de chat, notas de historial médico ya escritas, publicaciones creadas, ni la membresía en equipos de refugios ajenos. Plazo según Política de Privacidad: hasta 30 días, salvo obligación legal o investigación de fraude en curso.

---

## 5. Mascotas — ficha y datos

Colección `mascotas` (documento por mascota, dueño = `uidUsuario`). Campos principales: nombre, edad, sexo, fecha de nacimiento, especie, color, raza (si la especie es "Reptil", este campo se reutiliza para el tipo de reptil), castrado (Sí/No), foto principal + galería, peso, número de chip (15 dígitos si se informa), indicadores de comportamiento, señas particulares, estado (`normal` | `perdida`).

**Campos que existen en el modelo pero hoy NO tienen ninguna pantalla para cargarlos** (ver sección 24): alergias, enfermedades crónicas, medicamentos permanentes, compatibilidad con perros/gatos/niños, "es agresivo/a", contacto de emergencia propio de la mascota, observaciones de rescate. Se muestran (si existieran) en el carnet público y la ficha de mascota perdida, pero quedan siempre vacíos porque no hay forma de escribirlos desde la interfaz.

**Subcolecciones**: `vacunas`, `examenes` (con archivo de orden/resultado), `medicamentos` (soporta tratamientos en fases, con recordatorios locales por dosis), `citas` (agenda, con recordatorio 1h antes), `documentos` (PDFs adjuntos), `colaboradores` (hogar temporal), `accesosVeterinario` (accesos por PIN), `historialMedico` (notas de consulta, **append-only** — ni el dueño puede editar/borrar una nota ya escrita).

---

## 6. Crear y editar una mascota

**Crear** (`/tabs/crear-mascotas`): formulario con nombre, chip, sexo, fecha de nacimiento, edad, especie, tamaño, peso, color, raza, castrado, procedencia (Adopción/Compra/Regalo/Rescatado), señas particulares (obligatorias, 3–300 caracteres — es lo primero que ve quien encuentra a la mascota), notas de personalidad, indicadores de comportamiento (checkboxes). Foto principal + galería (JPEG/PNG/WebP/GIF, máx. 5 MB c/u).

**Límite de mascotas**: 2 para cuentas normales, 50 para cuentas `refugio` (o el valor de `maxPets` si está configurado distinto). Al llegar al tope, mensaje de "Actualiza a Premium para agregar más."

**Editar** (`/tabs/mascota-editar/:id/editar`): secciones Info Mascota (datos básicos + galería, sin incluir peso/tamaño/procedencia/salud crítica/compatibilidad — esos no son editables desde ningún lado, ver limitaciones), Calendario/Citas, Vacunas (catálogo típico según especie + "Otra"), Exámenes, Medicamentos (con fases de dosificación).

**Perfil rápido de la mascota** (`perfil-mascota`): accesos a Editar, Ver historial (carnet público), Ver QR, Compartir con veterinario, Reportar perdida/Marcar como encontrada, Dar en adopción/Dar hogar temporal, Publicar en adopción en el feed.

**Detalle con pestañas** (`/tabs/mascota-detalle/:id`): para dueño/equipo, pestañas "Veterinarias" e "Historial"; para un veterinario con acceso, aparece "Resumen" (datos clínicos de solo lectura) y arranca en "Historial" (sin "Veterinarias").

---

## 7. Carnet digital / QR público

Cada mascota tiene 2 tokens permanentes generados al crearla: uno para el **carnet médico** y otro para la ficha de **mascota perdida** (se generan al vuelo si faltaran, en mascotas creadas antes de esta función).

**"Mi QR"** (`/tabs/mascota-qr`): 3 tipos de QR descargables por mascota:
1. **QR Médico** → carnet público completo (`/carnet/{token}`).
2. **QR de Emergencia** → ficha de mascota perdida (`/perdida/{token}`).
3. **QR para veterinario** → codifica el ID de la mascota (no un token) — el PIN se pide aparte siempre, es lo que realmente autoriza el acceso.

**Carnet público** (`/carnet/:token`, sin necesidad de estar logueado): muestra identidad, foto, datos básicos, indicadores, señas particulares, salud crítica (si hubiera), compatibilidad, contacto de emergencia de la mascota, **datos del dueño (siempre visibles acá, sin condición sobre "perdida")**, galería, vacunas, medicamentos, exámenes, próximas citas. Nunca expone `uidUsuario`, el PIN, ni los tokens QR — eso lo filtra la propia Cloud Function `getCarnetPublico` antes de responder.

---

## 8. Mascota perdida

Misma mecánica de token que el carnet, pero (`/perdida/:token`):
- Solo muestra medicamentos **activos** (no el historial completo).
- **El contacto del dueño solo viaja en la respuesta si la mascota está marcada como perdida** (`estado === 'perdida'`) — si no, el backend directamente no lo manda (no es solo ocultamiento visual).
- Con la mascota marcada como perdida: franja roja de alerta, nombre y teléfono del dueño, botones Llamar/WhatsApp con mensaje predefinido, botón Compartir ficha, y el contacto de emergencia propio de la mascota si existe.
- Sin marcar: franja verde "no está reportada como perdida en este momento", solo se puede compartir la ficha.
- Siempre visibles (esté perdida o no): alertas médicas, señas particulares/chip, indicadores de comportamiento, observaciones de rescate.

**Activar/desactivar** desde `perfil-mascota`:
- Activar pide confirmación explícita ("a partir de ahora tu contacto va a ser visible...").
- Desactivar ("Marcar como encontrada") no pide confirmación.
- El token del QR **no cambia** al activar/desactivar — solo cambia si el backend expone o no el contacto detrás del mismo link.

---

## 9. Historial médico y PIN veterinario

Cada mascota tiene un **PIN de 6 dígitos** (`pinHistorial`) que el dueño genera/regenera desde `mascota-detalle` → pestaña Historial → "Compartir con veterinario", y comparte junto con el **ID de la mascota** (no el token QR) a un veterinario puntual, por el medio que sea (en persona, teléfono, etc.).

- **Regenerar el PIN no revoca accesos ya otorgados** — solo invalida el PIN viejo para futuros usos nuevos.
- El PIN **vence a los 90 días** de generado.
- El veterinario, desde su panel → "Agregar paciente", ingresa el ID + PIN a mano (o escanea el "QR para veterinario", que solo precarga el ID) — la Cloud Function `validarPinVeterinario` lo valida del lado del servidor.
- Requiere que la cuenta veterinaria esté **verificada** (`verificado === true`) — si no, mensaje: "Tu cuenta todavía no fue verificada por el equipo de Ashbis."
- Rate-limit: 20 intentos/minuto por cuenta, más bloqueo temporal por mascota ante intentos fallidos repetidos. Mensaje idéntico si el PIN es incorrecto o la mascota no existe (no da pistas).
- Con acceso otorgado, el veterinario tiene **solo lectura** de ficha/vacunas/exámenes/medicamentos/citas, y puede **agregar** (nunca editar/borrar) notas en el historial médico.
- El dueño puede **revocar** el acceso de un veterinario en cualquier momento; el veterinario también puede **quitarse a sí mismo**.
- **Notificaciones al dueño**: push cuando un veterinario obtiene acceso nuevo, y push cuando agrega una nota nueva al historial (no se autonotifica si la nota la escribe el propio dueño/equipo).

### Tipo de orden clínica y PDF automático

Cada nota del historial médico tiene un **tipo de orden**, elegido con un selector de chips antes de escribir: Consulta general, Receta médica, Vacunación/desparasitación, Examen/imagenología, Cirugía u Otro. El tipo elegido no agrega campos nuevos — sigue habiendo los mismos 4 campos de siempre (motivo, diagnóstico, tratamiento, observaciones) — pero cambia su etiqueta y su marcador de ejemplo para que se lean como el documento clínico que corresponde (por ejemplo, con "Receta médica" el campo de diagnóstico pasa a llamarse "Medicamento(s), dosis y vía").

**Si quien carga la nota es un veterinario**, además se genera automáticamente un **PDF de la orden**, con:
- Encabezado con el nombre, dirección y teléfono de la clínica/consulta, y el logo del veterinario (todo tomado de su Panel de Veterinario, sección 15).
- Tipo de orden, número de orden, fecha y hora.
- Datos del paciente (nombre, especie, raza, sexo, edad, peso, color, número de chip).
- Los 4 campos cargados, con la etiqueta del tipo elegido.
- Pie de firma: nombre y número de registro profesional del veterinario, más las imágenes de su firma y timbre (si las cargó en "Personalización de la atención").

El PDF se genera en el dispositivo del veterinario (sin pasar por ningún servidor propio) y se guarda en Storage; el enlace queda vinculado a esa entrada del historial (campo `pdfUrl`), con un botón "Ver PDF de la orden" en la lista. Como el historial médico es **append-only** (no se puede editar una nota después de creada), el PDF se genera y sube antes de guardar la nota, para que quede todo en una sola escritura. Si el veterinario no cargó logo, timbre o firma, el PDF sale igual, solo sin esas imágenes. **Si la nota la carga el dueño/equipo (no un veterinario), no se genera ningún PDF** — no tiene clínica ni datos profesionales que mostrar.

---

## 10. Transferencias: adopción y hogar temporal

Desde `perfil-mascota`, botones "Dar en adopción" / "Dar hogar temporal" — se identifica al destinatario por **email** o **escaneando su "Mi QR" de cuenta**. Solo cuentas `refugio` (dueño o equipo) pueden iniciar transferencias.

- **Adopción**: traspaso completo y permanente del dueño legal (se lleva todo el historial). Al aceptarse: cambia `uidUsuario`, borra cualquier colaborador de hogar temporal previo, y desactiva cualquier publicación de adopción activa de esa mascota.
- **Hogar temporal**: NO cambia el dueño — la otra persona queda como colaboradora, con acceso para ver/actualizar el perfil e historial. Una mascota solo puede tener un hogar temporal activo a la vez.
- **Aceptar** una transferencia SIEMPRE pasa por la Cloud Function `aceptarTransferencia` (nunca directo desde el cliente), que valida por el email real del token de sesión. **Rechazar/cancelar** sí lo puede hacer el cliente directo (solo cambia el estado).
- Se pueden ver y aceptar/rechazar desde **Notificaciones** (`/tabs/notificaciones`), con confetti y toast al aceptar.
- El refugio puede **reenviar** el aviso push de una transferencia pendiente, o **cancelarla**.
- Terminar un hogar temporal: se borra el colaborador — lo puede hacer el refugio o la propia persona colaboradora.

---

## 11. Panel de Refugio

Ruta `/tabs/refugio-panel/:refugioUid` (o sin uid, y el propio componente resuelve a cuál refugio corresponde). Visible para el dueño del refugio y cualquier miembro de su equipo.

**Contenido**:
- Tarjeta de verificación: si no está verificado, el **dueño** (no cualquier miembro) puede subir un documento legal (personería jurídica/RUT/certificado de constitución). La revisión es **100% manual** por el equipo de Ashbis desde Firebase Console — no hay panel de aprobación automatizado como sí existe para veterinarios (ver sección 17), ni aviso automático a Ashbis cuando se sube.
- Botón "Chat del equipo".
- Estadísticas de solo lectura: mascotas registradas, publicaciones activas, adopciones concretadas, hogares temporales activos, solicitudes pendientes, balance financiero.
- Botón "Finanzas del refugio".
- Lista de mascotas del refugio.
- Transferencias esperando respuesta (solo dueño): reenviar o cancelar.
- Publicaciones (solo lectura acá; gestionarlas de verdad es en "Mis publicaciones").
- Veterinarias asociadas: agregar/quitar (solo dueño), ver (cualquiera del equipo).
- Equipo: miembros con su rol dentro del equipo (Admin/Staff).

**Gestión del equipo**:
- Invitar: el dueño ingresa un email y elige explícitamente "Como staff" o "Como admin". **Nota**: las reglas de Firestore permiten que cualquier admin del equipo (no solo el dueño) invite gente nueva, pero el botón de la interfaz hoy solo aparece para el dueño (inconsistencia UI/reglas, ver sección 24).
- La persona invitada acepta desde sus propias Notificaciones — la Cloud Function `aceptarInvitacionEquipo` valida por su email real antes de darle acceso.
- **Admin vs. Staff**: ambos pueden operar la cuenta (mascotas, publicaciones, transferencias). Solo un admin (o el dueño) puede eliminar mascotas, invitar/cancelar invitaciones, y sacar a otros miembros.
- **Salir del equipo**: se hace desde **Configuración** (no desde el panel del refugio), sección "Equipos en los que colaboro".

---

## 12. Finanzas del refugio

Ruta `/tabs/refugio-finanzas/:refugioUid`, accesible para todo el equipo. **Aviso explícito en pantalla**: es solo una bitácora contable manual — **Ashbis no procesa, retiene ni transfiere dinero**.

- Resumen (ingresos/gastos/balance) + gráfica de barras de los últimos 6 meses.
- Registrar movimiento: tipo (gasto/ingreso), monto (CLP), categoría (alimentación, veterinaria, medicamentos, insumos, donación, adopción, eventos, transporte, otro), fecha, descripción.
- **Conexión con publicaciones de donación**: cada ingreso categoría "donación" suma automáticamente a `refugiosPublico/{uid}.totalDonacionesDeclaradas`, que es el monto que se muestra en las publicaciones de tipo donación con la leyenda "declaró haber recibido $X en donaciones (dato autodeclarado, no verificado por Ashbis)". Si se elimina el movimiento, se resta.

---

## 13. Publicaciones (adopción / recolección / donación)

Se gestionan desde "Mis publicaciones" (`/tabs/mis-publicaciones`) y se ven en el detalle público `/tabs/publicacion/:id` (accesible sin sesión).

- **Tipos**: Adopción, Recolección, Donación, Otro.
- **Quién puede publicar qué**: cuentas `refugio` pueden publicar los 4 tipos. **Cualquier cuenta** (sea o no refugio) puede publicar tipo Adopción de **una mascota propia** — así un dueño común también puede dar en adopción sin necesitar cuenta de refugio. Recolección y Donación siguen siendo exclusivos de refugios.
- Checkbox obligatorio de "declaro que la información es real" (exigido también a nivel de reglas de Firestore, no solo visual).
- Expiran automáticamente a los 30 días de creadas — no se puede estirar el plazo después.
- Se pueden pausar/reactivar o eliminar.
- El detalle muestra ubicación por comuna/región (nunca la dirección exacta), datos de la mascota si está vinculada, y el aviso de verificación/donaciones declaradas del refugio si corresponde.

**Flujo de postulación → chat → traspaso** (adopción):
1. Cualquier usuario postula con un mensaje opcional.
2. El refugio/dueño recibe push y ve la postulación en el detalle de su publicación — Aceptar o Rechazar.
3. Al **aceptar**, se abre un **chat directo** con el postulante (no transfiere la mascota todavía).
4. Desde el chat, el refugio puede **"Enviar traspaso"** — eso sí crea la transferencia real (sección 10), que la otra persona tiene que aceptar aparte desde Notificaciones.

---

## 14. Chats

Tres modalidades, unificadas en **"Mis chats"** (lista combinada, con puntito de no leído):

| | Chat de equipo | Chat directo |
|---|---|---|
| Para qué | Dueño + todo el equipo de un refugio, un solo hilo | Refugio ↔ un postulante concreto, para coordinar una adopción |
| Se crea | Existe siempre (implícito) para cada refugio | Recién al aceptar una postulación |
| Quién entra | Cualquiera del equipo | Solo los 2 participantes |
| Ruta | `/tabs/refugio-chat/:refugioUid` | `/tabs/chat-directo/:chatId` |
| Extra | — | Solo el refugio ve "Enviar traspaso de la mascota" |
| Mensajes | Append-only | Append-only, con tildes tipo WhatsApp (enviado/entregado/leído) |

---

## 15. Panel de Veterinario

Ruta `/tabs/veterinario-panel`, solo `rol === 'veterinario'`.

**Esta cuenta no puede tener mascotas propias**: la pestaña "Mis Mascotas" está oculta para `rol === 'veterinario'`, y las rutas `/tabs/listar-mascotas` y `/tabs/crear-mascotas` tienen un guard (`noVeterinarioGuard`) que redirige automáticamente al Panel de Veterinario si intenta entrar por URL directa. El único camino para que un veterinario acceda a una mascota es como paciente ajeno, con ID + PIN (sección 9).

**Perfil profesional** (editable): nombre de clínica/consulta, tipo (independiente/clínica chica/grande), modalidad de atención, **dirección y teléfono de la clínica** (distintos del teléfono personal — hace falta cargar este teléfono antes de poder pedir verificación, para frenar cuentas falsas), director/a técnico si es clínica, número de registro profesional, lugar de estudios, especialidades, **especies que atiende** (checkboxes).

**Verificación**: subir título/certificado (JPEG/PNG/WEBP/PDF, máx. 15 MB) → queda "en revisión". Mientras no esté `verificado: true`, no puede agregar pacientes. A diferencia de refugio, acá **sí hay aviso automático**: quien sube o cambia el título dispara un webhook a Discord avisando al equipo de Ashbis (con nombre, email, clínica, registro profesional y link al título). La aprobación/rechazo se hace desde el Panel admin (sección 17).

**Pacientes**: agregar por ID + PIN (sección 9), o escaneando el QR de la mascota (solo precarga el ID). Puede quitarse a sí mismo de un paciente sin pedirle nada al dueño.

**Personalización**: notas prediseñadas (frases reutilizables para completar más rápido el historial) y logo/timbre/firma (para personalizar, ej., al imprimir una ficha).

---

## 16. Panel de Servicio, Panel de Pyme y Buscador

### Panel de Servicio

Ruta `/tabs/servicio-panel`, solo `rol === 'servicio'` (peluquería/estética, guardería/pensión, funeraria, hotel para mascotas, transporte de mascotas).

**A diferencia de refugio/veterinario, esta cuenta NO pasa por ningún proceso de verificación** — no pide título, no hay tarjeta de "verificado", no hay revisión del equipo de Ashbis. Es simplemente una ficha de negocio editable: tipo de servicio, nombre del negocio, dirección y teléfono del negocio, descripción, logo, enlaces (sitio web, Instagram, Facebook, WhatsApp).

### Panel de Pyme

Ruta `/tabs/pyme-panel`, solo `rol === 'pyme'` — marcas/mini-emprendimientos que venden productos para mascotas (ropa, juguetes, accesorios, comida, snacks, u otro). Mismo criterio que Servicio: sin verificación, ficha de negocio editable con los mismos campos (tipo de pyme en vez de tipo de servicio, nombre de la marca, dirección/teléfono, descripción, logo, enlaces).

Ambos paneles muestran el aviso de que esta información "aparece cuando alguien te encuentra desde el buscador de Ashbis" — eso es exacto (ver abajo). Ninguna de las dos cuentas publica adopciones/campañas, ni tiene panel de finanzas o chat de equipo.

### El Buscador

Ruta `/tabs/buscador`, pestaña fija visible para cualquier rol (ver sección 1). Directorio público de veterinarios, servicios y pymes, alimentado por la colección `directorioPublico` — un espejo que las Cloud Functions mantienen sincronizado automáticamente cada vez que una cuenta de esos tres roles actualiza su perfil (nunca expone email, teléfono/dirección personal ni documentos de verificación, solo los campos "de negocio").

- **Categorías**: cuatro botones apilados verticalmente con ícono — Todos, Veterinarios, Servicios, Pymes.
- **Subopciones**: al elegir una categoría (excepto Todos) aparecen chips para filtrar más fino:
  - Veterinarios: por especialidad (General, Cardiología, Oncología, Odontología, Dermatología, Cirugía, Oftalmología) — matchea contra el campo `especialidades` (texto libre) del veterinario, no es un enum cerrado.
  - Servicios: por `tipoServicio` (peluquería, guardería, funeraria, hotel, transporte).
  - Pymes: por `tipoPyme` (ropa, juguetes, accesorios, comida, snacks, otro).
- También hay una barra de búsqueda por texto libre (nombre, especialidad, comuna...), que se combina con la categoría/subopción elegida.
- Refugios **no** aparecen en el Buscador — sus publicaciones de adopción/donación ya son públicas y tienen su propio feed en Home (ver sección 18).

---

## 17. Panel de administración de Ashbis

Ruta protegida por `adminGuard`, accesible **solo** para la cuenta `ashbis.oficial@gmail.com` (email hardcodeado en 3 lugares del código: reglas de Firestore, Cloud Functions, y el guard — si cambia, hay que actualizar los tres).

Gestiona **únicamente veterinarios pendientes de verificación**: lista con nombre, tipo de negocio, y link al título subido (los que todavía no subieron nada quedan al final de la lista). Botones "Aprobar" / "Rechazar" por fila, con confirmación.

**No hay panel equivalente para refugios** — su documento legal se revisa a mano en Firebase Console, sin aviso automático ni ETA.

---

## 18. Home / feed principal

`/tabs/home`. De arriba hacia abajo:
- Header: logo, botón "Mis chats" (con punto rojo de no leídos), campanita de notificaciones.
- Carrusel de 3 imágenes promocionales fijas.
- Acceso rápido a "Ver QR".
- **Mapa "Lugares para Mascotas"**: buscar Veterinaria o Tienda cercana (Google Places API, radio 5 km), con mapa de Google Maps, marcadores por tipo, favoritos (solo veterinarias), e info editable colaborativamente por usuarios para completar lo que Google no tiene. Requiere el permiso de "Ubicación" activado en Configuración.
- Carrusel de publicaciones activas tipo Recolección/Donación/Otro (Adopción tiene su sección aparte).
- Sección "Mascotas en adopción": tarjetas de publicaciones tipo Adopción.

---

## 19. Notificaciones

### Centro de notificaciones (`/tabs/notificaciones`)

Solo 3 tipos, todos **accionables** (aceptar/rechazar) — desaparecen de la lista en cuanto se resuelven, no hay "marcar como leída" aparte:
1. **Solicitudes de mascotas** (transferencias de adopción u hogar temporal).
2. **Postulaciones a tus publicaciones de adopción**.
3. **Invitaciones de equipo**.

**No aparecen acá** (solo llegan como push): avisos de acceso veterinario al historial, ni de notas nuevas en el historial médico.

### Push vs. locales — dos servicios distintos

- **Push (remoto, FCM)**: para eventos generados por otra persona/el servidor (mensajes, invitaciones, solicitudes, accesos veterinarios) — llega aunque la app esté cerrada. Nativo usa `@capacitor-firebase/messaging`; web usa Web Push (VAPID) + service worker (en Safari/iPhone solo funciona si la app está instalada en la pantalla de inicio).
- **Locales**: recordatorios programados en el propio dispositivo (citas 1h antes, vacunas el día correspondiente) — no dependen del servidor. Nativo usa `@capacitor/local-notifications`; en web, si el navegador soporta poco, el recordatorio solo dispara si la pestaña sigue abierta.

---

## 20. Chat con IA

`/tabs/chat-ia` — **deshabilitado a propósito** con un flag fijo en el código (`habilitado = false`), no por estar sin terminar. Motivo: el proxy a Gemini falla en producción durante la beta. El botón de acceso está oculto en Home; si alguien entra directo a la ruta, ve: *"El chat con IA no está disponible por el momento. Si tienes una duda sobre tu mascota, contáctanos a ashbis.oficial@gmail.com."*

Cuando esté activo: flujo guiado (categoría → tipo de mascota → chat libre), pensado tanto para dudas de salud/cuidado de mascotas como para ayuda de uso de la propia app.

---

## 21. Seguridad y privacidad

- **Sanitización**: todo texto ingresado en formularios pasa por `sanitizeText` (contra XSS) antes de guardarse; URLs por `sanitizeUrl` (bloquea `javascript:`/`data:`); archivos se validan por tipo MIME y tamaño antes de subir.
- **Reglas de Firestore**: patrón general — cada colección exige que quien escribe sea el dueño, un miembro autorizado del equipo, o pase por una Cloud Function con Admin SDK para las operaciones sensibles (aceptar transferencias/invitaciones, validar PIN, verificar cuentas). `rol` y `verificado` de un usuario nunca los puede tocar el cliente. Todo lo no contemplado explícitamente se deniega por defecto.
- **Storage**: fotos de mascotas/publicaciones son públicas; título de veterinario y documento legal de refugio son privados (solo su dueño los lee, hasta que el equipo de Ashbis los revisa manualmente).
- **Privacidad**: el teléfono del dueño y sus contactos de emergencia solo se exponen públicamente cuando la mascota está marcada como perdida (o siempre en el carnet médico, que requiere conocer el link/QR). Base legal: Ley 19.628 de Chile. Menores de 14 años no pueden usar la app. Ashbis es una plataforma de intermediación: no procesa pagos, no verifica de antemano lo publicado (pero exige declaración de veracidad y puede actuar ante fraude).

---

## 22. Guía de uso dentro de la app

Existe una **Guía de uso** in-app (`/tabs/guia`, accesible desde Configuración), con secciones: Tu cuenta, Mascotas, Carnet y QR, Mascota perdida, Adopciones, Hogar temporal, Panel de refugio, Asistente IA, Notificaciones, Configuración, Privacidad, Ayuda (contacto `ashbis.oficial@gmail.com`). Es la referencia oficial que ve el usuario mismo dentro de la app — vale la pena mantenerla como fuente primaria de verdad para el lenguaje/tono que espera un usuario.

---

## 23. Mapa de rutas

| Ruta | Quién la ve |
|---|---|
| `/login`, `/registro`, `/forgot-password` | Sin sesión |
| `/completar-perfil` | Con sesión, sin perfil creado aún (primer Google) |
| `/bienvenida` | Con sesión, recién creado el perfil |
| `/carnet/:token` | Público (QR médico) |
| `/perdida/:token` | Público (QR de mascota perdida) |
| `/terminos`, `/privacidad` | Público |
| `/tabs/home`, `/tabs/buscador` | Cualquier cuenta |
| `/tabs/listar-mascotas`, `/tabs/crear-mascotas` | Dueño/equipo/colaborador de la mascota — **bloqueado para `rol === 'veterinario'`** (redirige a `/tabs/veterinario-panel`) |
| `/tabs/perfil-mascota/:id`, `/tabs/mascota-editar/:id/editar`, `/tabs/mascota-detalle/:id`, `/tabs/mascota-qr` | Dueño/equipo/colaborador de la mascota, o veterinario con acceso por PIN a ese paciente puntual |
| `/tabs/perfil`, `/tabs/configuracion`, `/tabs/guia` | Cualquier cuenta |
| `/tabs/notificaciones` | Cualquier cuenta |
| `/tabs/mis-publicaciones`, `/tabs/publicacion/:id` | Gestionar: dueño de refugio o de la mascota. Ver detalle: público |
| `/tabs/refugio-panel(/:refugioUid)`, `/tabs/refugio-finanzas/:refugioUid`, `/tabs/refugio-chat/:refugioUid` | Dueño/equipo de un refugio |
| `/tabs/mis-chats`, `/tabs/chat-directo/:chatId` | Participantes de al menos un chat |
| `/tabs/veterinario-panel` | `rol === 'veterinario'` |
| `/tabs/servicio-panel` | `rol === 'servicio'` |
| `/tabs/pyme-panel` | `rol === 'pyme'` |
| `/tabs/admin-veterinarios` | Solo `ashbis.oficial@gmail.com` |
| `/tabs/chat-ia` | Cualquiera (pero deshabilitado, ver sección 20) |

---

## 24. Limitaciones y huecos conocidos

Para que el bot de soporte no prometa funciones que hoy no existen:

1. **Campos de salud/compatibilidad de la mascota sin UI de carga**: alergias, enfermedades crónicas, medicamentos permanentes, compatibilidad con perros/gatos/niños, "es agresivo/a", contacto de emergencia propio de la mascota, observaciones de rescate. Existen en el modelo de datos y se muestran en el carnet/ficha de perdida, pero ninguna pantalla permite escribirlos hoy.
2. ~~"Buscador de Ashbis" sin implementar~~ — **corregido el 2026-08-05**: el Buscador sí existe y está implementado (ver sección 16).
3. **Invitar al equipo de un refugio**: las reglas de Firestore permiten que cualquier admin del equipo invite gente nueva, pero el botón en la interfaz hoy solo aparece para el dueño original de la cuenta.
4. **Eliminar cuenta** no limpia mensajes de chat, notas de historial médico, publicaciones creadas ni membresías en equipos ajenos — quedan huérfanos.
5. **Verificación de refugio** es 100% manual (sin panel de aprobación ni aviso automático a Ashbis), a diferencia de veterinario que sí tiene ambas cosas.
6. **Chat con IA** está deshabilitado a propósito durante la beta (no es un bug ni algo roto — es una decisión activa hasta que se resuelva un problema con el proxy a Gemini en producción).
7. **Re-consentimiento**: no hay mecanismo para pedir de nuevo el consentimiento si cambia `consentVersion` — hoy todas las cuentas nuevas graban `'2.0'` fijo.
8. **App en fase beta**: sin garantía de disponibilidad continua (aclarado en Términos y Condiciones).
