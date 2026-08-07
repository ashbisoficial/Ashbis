# Plan de pruebas de Ashbis

> Plan de pruebas completo, organizado por secciones: qué tipos de prueba existen y cuándo usar cada uno, cómo hacer una prueba de humo (con checklist para correr a mano), casos funcionales por rol, plan de regresión de la entrega del 2026-08-06, y una sección de pruebas exploratorias con hallazgos reales encontrados al revisar el código. Se apoya en [Requerimientos de Ashbis](requerimientos-app-ashbis.md).
>
> Última actualización: 2026-08-06.

---

## 1. Alcance y objetivo

Verificar que la app cumple los requerimientos funcionales por rol (usuario, refugio, veterinario, servicio, pyme, admin) y que la entrega mergeada hoy a `main` (rol pyme, buscador con recomendación, órdenes clínicas en PDF, restricción de mascotas para veterinarios, español neutro en toda la app) no rompió nada de lo que ya funcionaba.

Entorno bajo prueba: `https://ashbis-ae5b2.web.app` (Firebase Hosting, proyecto `ashbis-ae5b2`).

---

## 2. Tipos de prueba — guía de referencia

| Tipo | Contesta la pregunta... | Cuándo se corre | Ejemplo en Ashbis |
|---|---|---|---|
| **Humo (smoke)** | ¿Lo básico funciona, vale la pena seguir probando? | Después de cada deploy, antes de cualquier otra prueba | Login entra, Home carga, se puede abrir una ficha de mascota |
| **Sanidad (sanity)** | ¿Este cambio puntual quedó bien? | Después de arreglar un bug específico | Después de arreglar el buscador, solo se re-verifica el buscador |
| **Funcional** | ¿Cada funcionalidad hace lo que dice el requerimiento? | Antes de cada release, o al terminar una feature | Crear una mascota guarda todos los campos correctamente |
| **Regresión** | ¿Algo que ya andaba se rompió con el cambio nuevo? | Después de un merge grande o refactor | El historial médico viejo (sin `tipo`) se sigue viendo bien tras agregar tipos de orden |
| **Exploratoria** | ¿Qué se me puede haber pasado por alto? (sin guion fijo) | Cuando ya se corrió el resto y se quiere buscar lo inesperado | Entrar como pyme y probar a propósito combinaciones raras de filtros en el buscador |
| **Integración** | ¿Las piezas se hablan bien entre sí? | Al conectar frontend↔Cloud Functions↔Firestore | Guardar una entrada de historial dispara `onHistorialMedicoCreado` y notifica al dueño |
| **Seguridad** | ¿Alguien puede acceder o hacer algo que no debería? | Siempre que cambian roles o `firestore.rules` | Un `usuario` no puede crear una entrada de historial en una mascota ajena |
| **Usabilidad** | ¿Es fácil de usar sin explicación previa? | Al rediseñar una pantalla | El selector de tipo de cuenta en el registro se entiende sin ayuda |
| **Compatibilidad** | ¿Funciona igual en distintos navegadores/tamaños de pantalla? | Antes de una release importante | Buscador y formularios en Chrome, Safari, y en móvil angosto |
| **Rendimiento** | ¿Carga rápido, no se traba? | Periódicamente, o si el bundle creció mucho | Tiempo de carga de `mascota-detalle` (461 KB, el chunk más pesado) |
| **Aceptación** | ¿Esto es lo que el usuario final necesitaba? | Al cerrar una feature grande | El rol pyme resuelve el caso real de un emprendimiento chico |

No todos se corren siempre. Para el día a día de esta app alcanza con: **humo** (siempre, rápido), **funcional + regresión** (antes de cada release), y **exploratoria** (cuando hay tiempo, para encontrar lo que el guion no cubre). Seguridad se revisa cada vez que cambian roles o reglas.

---

## 3. Pruebas de humo — cómo hacerlas (tutorial)

### 3.1 Qué es y para qué sirve

Una prueba de humo es un recorrido **corto y superficial** por los caminos más críticos de la app, para confirmar que nada básico está roto. El nombre viene de electrónica: "conectás el equipo, si sale humo, ni te molestás en seguir probando". No busca bugs sutiles — busca saber en 10-15 minutos si vale la pena invertir tiempo en pruebas más profundas, o si hay que frenar y arreglar algo primero.

**Regla de oro**: se corre siempre después de un deploy, antes de avisar "ya está arriba". Si un solo paso falla, se considera que la prueba de humo **falló completa** (no se sigue con el resto del checklist hasta arreglarlo).

### 3.2 Cómo se ejecuta

1. Abrí la app en una ventana nueva/incógnito (para no arrastrar sesión vieja en caché).
2. Andá siguiendo el checklist de la tabla de abajo, de arriba hacia abajo, en orden.
3. Por cada fila: hacé el paso, compará contra el resultado esperado, marcá OK o Falla.
4. Si algo falla: anotá el paso exacto, lo que viste vs. lo que esperabas, y una captura de pantalla si es visual. No sigas "adivinando" el resto del flujo roto — pasá al siguiente ítem del checklist si es independiente.
5. Al terminar: si todo dio OK, la app "pasó humo" y está lista para pruebas más profundas (sección 4) o para considerarse liberada.

### 3.3 Checklist de humo (~10-15 min, cubre las 5 cuentas + lo transversal)

| # | Paso | Resultado esperado | OK / Falla |
|---|---|---|---|
| 1 | Abrir `https://ashbis-ae5b2.web.app` | Carga la pantalla de login, sin errores en consola | |
| 2 | Iniciar sesión con una cuenta `usuario` existente | Entra a `/tabs/home` con el feed de publicaciones | |
| 3 | Abrir "Mis Mascotas" | Lista las mascotas de esa cuenta | |
| 4 | Abrir la ficha de una mascota | Carga datos + pestañas (historial, vacunas, etc.) sin quedarse en blanco | |
| 5 | Abrir el Buscador | Carga la lista de veterinarios/servicios/pymes sin quedarse en el spinner | |
| 6 | Tocar la categoría "Veterinarios" en el Buscador | Aparecen subopciones de especialidad y la lista se filtra | |
| 7 | Cerrar sesión y registrarse con una cuenta nueva de prueba, rol "Veterinario" | Termina el registro y entra a `/tabs/home` | |
| 8 | Con esa cuenta veterinario, abrir el tab bar | NO aparece "Mis Mascotas" (ver RN-03) | |
| 9 | Abrir "Panel de veterinario" y guardar un dato simple | Guarda sin error | |
| 10 | Registrar una cuenta rol "Pyme" | Termina el registro, panel de pyme accesible y guardable | |
| 11 | Ir a "Guía" / manual dentro de la app | Carga el contenido, texto en español neutro (sin "vos/tenés") | |
| 12 | Abrir "Configuración" → cambiar algo reversible (ej. tema) | Se aplica sin recargar con error | |
| 13 | Cerrar sesión | Vuelve a login sin quedar colgado | |

Si los 13 pasos dan OK, la app "pasó humo". Con eso alcanza para decir "el deploy no rompió lo básico" — no reemplaza el resto de este documento.

---

## 4. Plan funcional por sección

Formato de cada caso: **ID — Precondición → Pasos → Resultado esperado**.

### 4.1 Autenticación y registro

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| AUTH-01 | Sin sesión | Ir a `/registro`, elegir rol "Dueño", completar y enviar | Cuenta creada, redirige a `/bienvenida` y luego a Home |
| AUTH-02 | Sin sesión | Registrar rol "Veterinario" sin completar nombre de clínica | El formulario bloquea el envío (campo obligatorio) |
| AUTH-03 | Sin sesión | Registrar rol "Pyme", tipo "Ropa" | Cuenta creada con `tipoPyme='ropa'`; aparece luego en el Buscador bajo Pymes |
| AUTH-04 | Cuenta Google nueva | Login con Google por primera vez | Redirige a `/completar-perfil` (no a Home directo) antes de elegir rol |
| AUTH-05 | Cuenta existente | Login con contraseña incorrecta | Mensaje de error claro, no rompe la pantalla |
| AUTH-06 | Sesión activa | Navegar manualmente a `/login` o `/registro` por URL | `publicGuard` redirige a `/tabs/home` |
| AUTH-07 | Sin sesión | Navegar manualmente a `/tabs/home` por URL | `authGuard` redirige a `/login` |

### 4.2 Usuario (dueño de mascota)

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| PET-01 | Cuenta `usuario` logueada | Crear mascota con datos mínimos (nombre, especie, sexo, raza) | Se guarda y aparece en "Mis Mascotas" |
| PET-02 | Mascota creada | Completar campos extendidos (alergias, indicadores, compatibilidad) | Se guardan y se muestran en la ficha |
| PET-03 | Mascota creada | Generar QR de carnet médico y abrirlo sin sesión (ventana incógnita) | Muestra ficha pública, sin exponer datos privados del dueño más allá de lo previsto |
| PET-04 | Mascota creada | Marcar como "perdida", abrir el QR de perdida sin sesión | Muestra ficha reducida acorde al estado perdida |
| PET-05 | Mascota creada | Generar PIN de historial, copiarlo | PIN de 6 dígitos, se puede regenerar |
| PET-06 | — | Cuenta `veterinario` intenta ir a `/tabs/crear-mascotas` por URL | `noVeterinarioGuard` redirige a `/tabs/veterinario-panel` |

### 4.3 Historial médico y PIN veterinario

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| HIST-01 | Dueño en ficha de mascota | Cargar entrada con solo "motivo" completo | Se guarda (alcanza con 1 de los 4 campos) |
| HIST-02 | Dueño en ficha de mascota | Intentar guardar entrada con los 4 campos vacíos | Botón "Guardar" deshabilitado o bloqueado |
| HIST-03 | Veterinario con PIN válido de una mascota | Cargar entrada tipo "Vacunación" | Se guarda y se genera automáticamente un PDF de orden clínica con membrete del veterinario |
| HIST-04 | PDF generado | Abrir el PDF | Incluye datos de la mascota + nombre de clínica/veterinario + logo/firma si están cargados |
| HIST-05 | Entrada ya guardada | Intentar editar o borrar una entrada existente | No hay opción de editar/borrar (append-only) |
| HIST-06 | PIN generado hace >90 días | Veterinario intenta usarlo | Rechazado por vencido |
| HIST-07 | Veterinario con acceso otorgado | El dueño del refugio revisa notificaciones | Recibe aviso de que el veterinario accedió/escribió una nota |

### 4.4 Refugio

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| REF-01 | Cuenta `refugio` | Crear publicación tipo "adopción" vinculada a una mascota | Aparece en el feed de Home para otros usuarios |
| REF-02 | Publicación de adopción activa | Otro usuario postula | Refugio ve la postulación pendiente |
| REF-03 | Postulación pendiente | Refugio la acepta | Se abre un chat directo; la mascota NO cambia de dueño todavía |
| REF-04 | Chat abierto | Refugio envía Transferencia tipo "adopción" | Al aceptarla el postulante, `mascotas/{id}.uidUsuario` cambia al nuevo dueño |
| REF-05 | — | Refugio envía Transferencia tipo "hogar_temporal" | Al aceptarla, se agrega como colaborador; el refugio sigue siendo dueño legal |
| REF-06 | Cuenta refugio | Invitar a un email nuevo al equipo | Se crea invitación pendiente; al aceptar, aparece como miembro |
| REF-07 | Miembro `staff` | Intenta eliminar una mascota del refugio | Bloqueado (solo `admin` del equipo o dueño original) |
| REF-08 | Cuenta refugio | Cargar movimiento financiero (ingreso/gasto) | Se guarda en la bitácora, sin mover dinero real |

### 4.5 Veterinario

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| VET-01 | Cuenta `veterinario` recién creada | Revisar tab bar | Sin "Mis Mascotas"/"Crear mascota" |
| VET-02 | Panel de veterinario | Completar especialidades, especies atendidas, modalidad de atención | Se guarda y luego aparece reflejado en el Buscador |
| VET-03 | Cuenta veterinario sin verificar | Subir título/registro profesional | Queda pendiente de revisión (admin) |
| VET-04 | Admin logueado | Ir a `/tabs/admin-veterinarios`, aprobar la cuenta | `verificado` pasa a `true`; badge "Verificado" visible en el Buscador |
| VET-05 | Cuenta veterinario NO admin | Navegar a `/tabs/admin-veterinarios` por URL | `adminGuard` redirige a Home |

### 4.6 Servicio y Pyme

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| SRV-01 | Cuenta `servicio`, tipo "Hotel" | Completar panel (nombre, dirección con autocomplete, teléfono, redes) | Se guarda con lat/lng capturadas |
| SRV-02 | Panel completo | Verificar reflejo en `directorioPublico` (Buscador → Servicios → Hotel) | Aparece con los datos cargados |
| PYME-01 | Cuenta `pyme`, tipo "Snacks" | Completar panel + subir logo | Se guarda; logo visible en su tarjeta del Buscador |
| PYME-02 | Cuenta pyme | Intentar acceder a rutas de veterinario/refugio por URL | Bloqueado por guard/reglas |

### 4.7 Buscador

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| BUS-01 | Buscador abierto, categoría "Todos" | Sin filtros | Lista todos los veterinarios/servicios/pymes activos |
| BUS-02 | — | Tocar "Veterinarios" | Aparecen chips de especialidad (Cardiología, Oncología, etc.) |
| BUS-03 | Categoría "Veterinarios" | Tocar "Cardiología" | Solo quedan veterinarios cuyo texto de especialidades incluye "cardiología" |
| BUS-04 | Categoría "Servicios" | Tocar "Hotel" | Solo servicios con `tipoServicio === 'hotel'` |
| BUS-05 | Categoría "Todos", usuario con mascota "perro" | Revisar orden de resultados | Veterinarios que atienden perros aparecen primero, con badge "Recomendado" |
| BUS-06 | — | Escribir texto en la barra de búsqueda **⚠️ ver hallazgo EXP-01** | Ver sección 6.3 — comportamiento actualmente no confiable |
| BUS-07 | Categoría con subopción activa | Cambiar a otra categoría | La subopción se resetea (no arrastra "Cardiología" a "Servicios") |

### 4.8 Chats y notificaciones

| ID | Precondición | Pasos | Resultado esperado |
|---|---|---|---|
| CHAT-01 | Chat directo activo | Enviar mensaje | Aparece con marca de enviado → entregado → leído |
| CHAT-02 | Miembro de equipo de refugio | Enviar mensaje en chat de equipo | Visible para todo el equipo, no editable/borrable |
| CHAT-03 | Cualquier cuenta | Abrir Chat IA | Responde sin error |
| NOTIF-01 | Se genera un evento (transferencia, postulación, etc.) | Revisar campana de notificaciones | Aparece la notificación correspondiente |

### 4.9 Idioma neutro (transversal)

| ID | Pasos | Resultado esperado |
|---|---|---|
| I18N-01 | Recorrer registro, guía, paneles de negocio, buscador, chats | Ningún texto usa voseo rioplatense ("vos", "tenés", "podés", imperativos en "-á/-í") |
| I18N-02 | Revisar mensajes de error y placeholders de formularios | Español neutro también en validaciones (no solo en el texto estático) |

---

## 5. Plan de regresión — entrega del 2026-08-06

Esta entrega mezcló dos ramas de trabajo en paralelo (11 archivos con conflicto real reconciliados a mano). Estos son los puntos de mayor riesgo a re-verificar con prioridad:

| Área | Qué pudo haberse roto | Cómo verificar |
|---|---|---|
| `mascota-detalle.component.*` | Es el archivo con más conflicto: combina "orden clínica con tipos + PDF" con cambios de refugio/hogar temporal | Recorrer TODAS las pestañas de una ficha de mascota (datos, historial, vacunas, exámenes, medicamentos, citas, hogar temporal) con cuenta dueño Y con cuenta veterinario |
| `firestore.rules` | Reglas de `usuarios` y `historialMedico` tocadas por ambas ramas | Repetir HIST-01 a HIST-06 y AUTH-01 a AUTH-03; probar también que un rol NO autorizado sea rechazado (ver sección 7) |
| `functions/src/index.ts` | `onUsuarioActualizado` sincroniza `directorioPublico` para 3 roles ahora | Editar perfil de veterinario/servicio/pyme y confirmar que el Buscador refleja el cambio en segundos |
| `veterinario-panel`, `servicio-panel` | Ambos tocados por las dos ramas (coordenadas de negocio + tipos nuevos) | SRV-01, VET-02, confirmar que "hotel" y "transporte" aparecen como opciones |
| `tabs.component` | Visibilidad de tabs por rol + tab nuevo de Pyme | Revisar tab bar con las 5 cuentas de rol distinto |
| `configuracion.component` | Cambios de idioma (`ngx-translate`) mezclados con ajustes previos | Recorrer todas las opciones de Configuración con cada cuenta |
| `home.component` | Selector de idioma ES/EN agregado | Cambiar idioma y confirmar que no rompe el feed ni deja texto sin traducir a medias |
| Dependencias (`@ngx-translate/core`) | Faltaba en `node_modules` tras el merge (ya resuelto con `npm install`) | Confirmar que el build de producción no tiene errores de módulos faltantes |

---

## 6. Pruebas exploratorias

### 6.1 Qué son

A diferencia de los casos de la sección 4 (guion fijo, resultado esperado predefinido), la prueba exploratoria es **simultáneamente diseñar y ejecutar**: se navega la app con un objetivo amplio ("carta"/charter) y una ventana de tiempo corta, buscando activamente lo que un guion no anticiparía — combinaciones raras, datos límite, flujos interrumpidos a mitad de camino.

### 6.2 Cartas de exploración (para correr manualmente, ~20-30 min cada una)

1. **Carta "Buscador combinado"**: como cuenta `usuario` con mascotas de más de una especie, probar todas las combinaciones de categoría + subopción + texto de búsqueda + borrar el texto a mitad de escribir. Anotar cualquier resultado que no coincida con lo esperado.
2. **Carta "Registro a medio camino"**: empezar un registro con cada uno de los 5 roles, y en cada uno abandonar el formulario en un punto distinto (recargar la página, ir atrás con el botón del navegador, cerrar y reabrir). Ver si queda algún estado inconsistente (cuenta de Auth creada sin perfil en Firestore, por ejemplo).
3. **Carta "Multi-rol en un dispositivo"**: cerrar sesión y volver a entrar alternando rápido entre una cuenta veterinario y una cuenta usuario en la misma pestaña del navegador. Buscar restos de datos de la sesión anterior (mascotas, chats) que no deberían verse.
4. **Carta "Historial largo"**: en una mascota con muchas entradas de historial (10+, mezclando tipos), revisar que el orden, los PDFs y el rendimiento de scroll se mantengan usables.
5. **Carta "Permisos cruzados"**: con dos pestañas del navegador (dos cuentas distintas), intentar que una cuenta `usuario` común acceda por URL directa a rutas de refugio/veterinario/admin ajenas, y confirmar que Firestore (no solo el guard de Angular) también lo rechaza.

### 6.3 Hallazgos de la revisión exploratoria de código (esta sesión)

Además de leer requerimientos, se revisó el código del Buscador buscando específicamente errores de reactividad (un tipo de bug común en Angular con Signals, difícil de ver solo mirando la pantalla). Se encontró lo siguiente:

> **EXP-01 — La búsqueda por texto libre del Buscador no se actualiza sola al escribir.**
> **Dónde**: [`src/app/buscador/buscador.component.ts`](../src/app/buscador/buscador.component.ts) línea 104 (`filtroTexto = ''`) y línea 132-164 (`resultados = computed(...)`, que lee `this.filtroTexto` en la línea 135).
> **Por qué pasa**: `resultados` es un `computed()` de Angular Signals. Un `computed()` solo vuelve a calcularse cuando una **signal** que lee adentro cambia — no cuando cambia una propiedad de clase común. `filtroTexto` es una propiedad común (`string`), atada al buscador con `[(ngModel)]` en el HTML (línea 7), no una signal. Como resultado, escribir en la barra de búsqueda actualiza `filtroTexto`, pero `resultados()` no se recalcula solo — sigue devolviendo la lista vieja hasta que **otra** signal de la que sí depende (`filtroRol` o `filtroSubtipo`) cambie por otro motivo (por ejemplo, tocar una categoría).
> **Cómo reproducirlo**: abrir el Buscador → categoría "Todos" → escribir un nombre en la barra de búsqueda. La lista se queda igual. Recién al tocar cualquier botón de categoría, la lista se filtra usando el texto que ya estaba escrito.
> **Impacto**: la búsqueda por texto parece no funcionar la mayoría de las veces (falla de usabilidad importante en una función core del buscador), aunque el dato sí se guarda correctamente — es un problema de cuándo se recalcula, no de qué se calcula.
> **Sugerencia de arreglo** (para cuando se decida priorizarlo): convertir `filtroTexto` en `signal('')` y usar `filtroTexto()`/`filtroTexto.set(...)` en vez de la propiedad común — mismo patrón que ya usan `filtroRol`, `filtroSubtipo`, `miRegion` y `miComuna` en el mismo archivo.

No se marca como corregido en esta entrega — queda registrado acá para decidir prioridad, ya que no fue parte de lo pedido en la sesión.

---

## 7. Seguridad — verificación rápida de reglas

No reemplaza una auditoría completa de `firestore.rules`, pero cubre los cruces de mayor riesgo:

| ID | Prueba | Resultado esperado |
|---|---|---|
| SEC-01 | Cuenta `usuario` intenta escribir directo en `directorioPublico/{cualquier-uid}` (vía consola del navegador) | Rechazado — solo lo escribe la Cloud Function con Admin SDK |
| SEC-02 | Cuenta `usuario` intenta cambiar su propio `rol` a `veterinario` con un `update` | Rechazado por la regla (rol inmutable tras el `create`) |
| SEC-03 | Cuenta cualquiera intenta poner `verificado: true` en su propio perfil | Rechazado |
| SEC-04 | Cuenta veterinario SIN acceso por PIN a una mascota intenta leer su historial | Rechazado |
| SEC-05 | Cuenta `staff` de un equipo de refugio intenta eliminar una mascota | Rechazado (requiere `admin` del equipo o dueño original) |

---

## 8. Gestión de hallazgos y criterio de salida

- Un hallazgo se registra con: dónde (archivo/pantalla), pasos para reproducir, resultado esperado vs. obtenido, y severidad (bloqueante / importante / menor).
- **Criterio de salida para un deploy**: humo (sección 3) 100% OK. Funcional (sección 4) sin fallas bloqueantes. Regresión (sección 5) sin fallas nuevas en las áreas de riesgo listadas. Los hallazgos exploratorios (sección 6) se priorizan aparte, no bloquean el release salvo que sean de seguridad.
