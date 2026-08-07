# Requerimientos de Ashbis

> Documento de requerimientos del producto: qué es la app, quiénes la usan y qué debe poder hacer cada quien. Sirve de base para el [Plan de pruebas](plan-de-pruebas-ashbis.md) y se actualiza cuando cambian las reglas de negocio, no en cada detalle visual.
>
> Última actualización: 2026-08-06.

## 1. Resumen del producto

Ashbis es una app (Ionic + Angular + Capacitor, backend en Firebase) para la gestión integral de mascotas y la conexión entre dueños, refugios y negocios relacionados con el cuidado animal. Cubre: ficha e historial médico de mascotas, adopción/transferencia de dueño, gestión operativa de refugios, atención veterinaria con historial compartido por PIN, y un directorio público (buscador) de veterinarios, servicios y pymes.

No procesa pagos ni retiene dinero entre personas (ver Términos, sección 8) — las finanzas de refugio son una bitácora interna, y el contacto con negocios del buscador se coordina fuera de la app (teléfono, WhatsApp, redes).

## 2. Tipos de usuario (roles)

El rol se autodeclara al crear la cuenta (`usuarios/{uid}.rol`) y es **inmutable** después — no se puede cambiar editando el perfil (ver [firestore.rules](../firestore.rules) línea ~118). Esto es una decisión de seguridad: si se pudiera cambiar, cualquier cuenta se autootorgaría permisos de refugio/veterinario.

| Rol | Verificación manual | Tiene mascotas propias | Panel de negocio | Aparece en el Buscador |
|---|---|---|---|---|
| `usuario` | No | Sí | No | No |
| `refugio` | Sí (documento legal) | Sí (las que gestiona) | Panel de refugio | No (usa `refugiosPublico`, feed de publicaciones en Home) |
| `veterinario` | Sí (título/registro profesional) | **No** (restringido — ver RN-03) | Panel de veterinario | Sí |
| `servicio` | No | Sí | Panel de servicio | Sí |
| `pyme` | No | Sí | Panel de pyme | Sí |

Sub-tipos de negocio:
- **`veterinario.tipoNegocioVeterinario`**: `independiente` \| `clinica_pequena` \| `clinica_grande`.
- **`servicio.tipoServicio`**: `peluqueria` \| `guarderia` \| `funeraria` \| `hotel` \| `transporte`.
- **`pyme.tipoPyme`**: `ropa` \| `juguetes` \| `accesorios` \| `comida` \| `snacks` \| `otro`.

Cuenta especial: **admin de Ashbis**, identificada por email fijo (`ashbis.oficial@gmail.com`) en tres lugares que deben coincidir: `auth.guard.ts` (`ADMIN_EMAILS`), `firestore.rules` (`esAdminAshbis()`) y `functions/src/index.ts` (`ADMIN_EMAILS`). Accede a `/tabs/admin-veterinarios` para aprobar/rechazar verificaciones.

## 3. Requerimientos funcionales

### 3.1 Cuenta y autenticación
- RF-01 — Registro con email/contraseña o con Google, eligiendo tipo de cuenta (5 roles) en un paso con tarjetas con ícono.
- RF-02 — Quien entra con Google por primera vez completa el tipo de cuenta en `/completar-perfil` (ya autenticado, perfil aún no existe en Firestore).
- RF-03 — Formulario de registro pide campos adicionales según el rol elegido (nombre de clínica/negocio, tipo, teléfono/dirección de negocio, etc.).
- RF-04 — Recuperación de contraseña (`/forgot-password`).
- RF-05 — `perfilCompletoGuard` impide entrar a `/tabs/*` si el documento `usuarios/{uid}` todavía no existe (evita perfiles a medio crear).

### 3.2 Gestión de mascotas (rol `usuario`, `refugio`)
- RF-10 — Alta de mascota con datos básicos (especie, raza, sexo, edad, foto) y extendidos (peso, chip, alergias, enfermedades crónicas, medicación permanente, señas particulares, compatibilidad con perros/gatos/niños, agresividad).
- RF-11 — Subcolecciones por mascota: vacunas, exámenes, medicamentos, citas.
- RF-12 — QR de carnet médico (público, sin login) y QR de "mascota perdida" (expone menos datos, solo mientras está marcada como perdida).
- RF-13 — PIN de 6 dígitos regenerable para otorgar acceso veterinario puntual al historial (vence a los 90 días).
- RF-14 — `noVeterinarioGuard` bloquea `/tabs/listar-mascotas` y `/tabs/crear-mascotas` para cuentas `veterinario` (ver RN-03).

### 3.3 Historial médico
- RF-20 — Entradas de historial append-only (no se editan ni borran), con tipo (`consulta`\|`receta`\|`vacunacion`\|`examen`\|`cirugia`\|`otro`) y al menos uno de 4 campos (motivo/diagnóstico/tratamiento/texto) completo.
- RF-21 — Puede escribir una entrada: el dueño/equipo del refugio, un colaborador de hogar temporal, o un veterinario con acceso otorgado por PIN.
- RF-22 — Cuando la carga un veterinario, se genera automáticamente un PDF de la orden clínica (datos de la mascota + membrete del veterinario: clínica, teléfono, dirección, logo/firma/timbre) y se adjunta a la entrada (`pdfUrl`).
- RF-23 — El membrete del PDF es un snapshot al momento de la consulta (no se recalcula si el veterinario cambia sus datos después).

### 3.4 Refugios
- RF-30 — Publicaciones (adopción/recolección/donación/otro), expiran a los 30 días.
- RF-31 — Postulaciones de adopción sobre una publicación; aceptar abre un chat directo (no transfiere la mascota automáticamente).
- RF-32 — Transferencias de dueño (`adopcion`, cambia dueño legal) u hogar temporal (`hogar_temporal`, acceso compartido sin cambiar dueño).
- RF-33 — Equipo de refugio: invitar por email, roles `admin`/`staff` dentro del equipo, chat grupal interno.
- RF-34 — Bitácora financiera manual (ingresos/gastos por categoría) — no mueve dinero real.
- RF-35 — Info pública antifraude (`refugiosPublico`): verificado + total de donaciones declaradas.
- RF-36 — Notificación al dueño del refugio cuando un veterinario accede o escribe una nota en una mascota del refugio.

### 3.5 Paneles de negocio (veterinario / servicio / pyme)
- RF-40 — Cada rol de negocio tiene su panel propio (datos de negocio, logo, redes, descripción) editable, con datos "de negocio" separados de los datos personales de la cuenta.
- RF-41 — Veterinario declara además especialidades, modalidad de atención, especies atendidas, lugar de estudios y notas prediseñadas para el historial.
- RF-42 — Veterinario y refugio pasan por verificación manual del equipo de Ashbis (sube título/documento legal; el campo `verificado` nunca lo puede poner en `true` el propio cliente).
- RF-43 — Dirección de negocio capturada vía Google Places Autocomplete, guardando también lat/lng para mapa y orden por cercanía.

### 3.6 Buscador (directorio público)
- RF-50 — Lista veterinarios, servicios y pymes verificados/activos desde `directorioPublico` (sincronizado por Cloud Function `onUsuarioActualizado`, nunca escrito directo por el cliente).
- RF-51 — Filtro por categoría (Todos/Veterinarios/Servicios/Pymes) con subopciones dependientes: especialidad (veterinarios), tipo de servicio, tipo de pyme.
- RF-52 — Búsqueda por texto libre (nombre, tipo, comuna, región, especialidad, especie atendida).
- RF-53 — En la pestaña "Todos", algoritmo de recomendación por puntaje: +5 si el veterinario atiende la especie de alguna mascota propia, +2 misma comuna, +1 misma región, +1 veterinario verificado. Se muestra badge "Recomendado" si el puntaje es mayor a 0.
- RF-54 — Refugios NO aparecen en el buscador (tienen su propio feed de publicaciones en Home).

### 3.7 Chats
- RF-60 — Chat directo dueño↔refugio por postulación aceptada (append-only, con recibo de entrega/lectura).
- RF-61 — Chat de equipo interno del refugio (un solo hilo grupal).
- RF-62 — Chat IA (asistente dentro de `/tabs/chat-ia`).

### 3.8 Notificaciones
- RF-70 — Notificaciones in-app para: transferencias, postulaciones, invitaciones de equipo, mensajes de chat, acceso veterinario otorgado, entrada nueva en historial médico, etc.

### 3.9 Panel admin
- RF-80 — `/tabs/admin-veterinarios`: revisar y aprobar/rechazar verificación de cuentas veterinario/refugio pendientes.

## 4. Requerimientos no funcionales

- RNF-01 — **Seguridad por reglas del lado del servidor**: todo lo que la UI oculta (guards de Angular) está reforzado en `firestore.rules` — los guards son solo comodidad de navegación, nunca la única barrera.
- RNF-02 — **Rol autodeclarado, no es identidad verificada**: el acceso a datos sensibles (historial médico) nunca depende solo del rol declarado, sino de reglas de pertenencia (dueño/equipo/colaborador) o del PIN veterinario.
- RNF-03 — **Español neutro obligatorio** en todo texto nuevo de la interfaz (sin voseo rioplatense) — ver [[feedback_spanish_neutral]].
- RNF-04 — **Serverless / Firebase**: Hosting + Cloud Functions 2ª gen (Cloud Run) + Firestore + Storage, proyecto `ashbis-ae5b2`. Sujeto a la cuota de CPU total por proyecto/región de Cloud Run (afecta despliegues, no el runtime en producción).
- RNF-05 — **Multiplataforma**: Ionic/Angular standalone + Capacitor — mismo código para web (`ashbis-ae5b2.web.app`) y potencialmente Android/iOS.
- RNF-06 — **Carga diferida por ruta** (`loadComponent`) para mantener el bundle inicial liviano.
- RNF-07 — **CSP estricta** en `firebase.json` (Content-Security-Policy con lista blanca de orígenes: Google, Firebase, Maps, Cloudflare Turnstile).

## 5. Reglas de negocio clave

- RN-01 — El rol se elige una vez y no se puede cambiar después.
- RN-02 — `verificado` solo lo cambia el equipo de Ashbis a mano en Firebase Console (Admin SDK ignora las reglas de cliente).
- RN-03 — Una cuenta `veterinario` no puede tener mascotas propias — accede a pacientes ajenos solo vía PIN por mascota.
- RN-04 — El PIN de historial vence a los 90 días; regenerarlo no revoca accesos ya otorgados (eso se hace aparte, quitando el documento de `accesosVeterinario`).
- RN-05 — El historial médico es append-only: ni el dueño ni el veterinario pueden editar o borrar una entrada ya escrita.
- RN-06 — El PDF de orden clínica se genera únicamente en el `create` original de la entrada (no se puede agregar después con un update).
- RN-07 — Aceptar una postulación de adopción NO transfiere la mascota — solo abre un chat; el traspaso real pasa siempre por `Transferencias`.
- RN-08 — `hogar_temporal` da acceso compartido sin cambiar el dueño legal; `adopcion` sí cambia `mascotas/{id}.uidUsuario`.

## 6. Fuera de alcance

- Procesamiento de pagos o custodia de dinero entre personas.
- Verificación automática de identidad/título profesional (siempre manual, por el equipo de Ashbis).
- Agenda/reserva de turnos dentro de la app (el contacto con negocios del buscador se coordina por fuera).

## 7. Glosario

- **Directorio público**: colección `directorioPublico`, espejo de solo-lectura de los datos de negocio de veterinario/servicio/pyme, mantenida únicamente por Cloud Functions.
- **Membrete**: snapshot de los datos profesionales del veterinario copiado dentro de una entrada de historial al momento de crearla.
- **Colaborador**: persona con acceso compartido a UNA mascota puntual (hogar temporal), sin ser dueña ni parte del equipo del refugio.
- **Equipo de refugio**: varias cuentas (`miembros`) operando el mismo perfil de refugio, con rol interno `admin` o `staff`.
