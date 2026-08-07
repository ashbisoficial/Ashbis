import { Routes } from '@angular/router';
import { adminGuard, authGuard, noVeterinarioGuard, perfilCompletoGuard, publicGuard } from './guards/auth.guard';
import { TabsComponent } from './tabs/tabs.component';

export const routes: Routes = [
  // ── Rutas públicas (no autenticado) ─────────────────────────────────────
  {
    path: 'login',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./auth/pages/registro/registro.component').then((m) => m.RegistroComponent),
  },
  {
    path: 'forgot-password',
    canActivate: [publicGuard],
    loadComponent: () =>
      import('./auth/pages/forgot-password/forgot-password.component').then(
        (m) => m.ForgotPasswordComponent
      ),
  },
  // Adonde apunta el link del correo de recuperación (ver
  // AuthenticationService.resetPassword) — sin guard, a propósito: alguien
  // puede abrir este link desde otro dispositivo/sesión donde ya esté
  // logueado con OTRA cuenta, y publicGuard lo mandaría directo a Home en
  // vez de dejarlo cambiar la contraseña.
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./auth/pages/reset-password/reset-password.component').then(
        (m) => m.ResetPasswordComponent
      ),
  },
  // Paso extra tras el primer login con Google (elegir tipo de cuenta) — ya
  // está autenticado, por eso usa authGuard y no publicGuard.
  {
    path: 'completar-perfil',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/pages/completar-perfil/completar-perfil.component').then(
        (m) => m.CompletarPerfilComponent
      ),
  },
  // Preferencias (tema, tamaño de letra, notificaciones, cámara/ubicación)
  // mostradas una vez, justo después de crear la cuenta (desde /registro o
  // /completar-perfil) y antes de entrar a /tabs/home. El perfil ya existe
  // en este punto, por eso alcanza con authGuard (perfilCompletoGuard solo
  // protege /tabs).
  {
    path: 'bienvenida',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./auth/pages/bienvenida/bienvenida.component').then(
        (m) => m.BienvenidaComponent
      ),
  },

  // ── Carnet público (se accede vía QR, sin login) ────────────────────────
  {
    path: 'carnet/:id',
    loadComponent: () =>
      import('./carnet-mascota/carnet-mascota.page').then((m) => m.CarnetMascotaPage),
  },

  // ── Ficha pública de mascota perdida (se accede vía QR, sin login) ──────
  {
    path: 'perdida/:token',
    loadComponent: () =>
      import('./mascota-perdida/mascota-perdida.page').then((m) => m.MascotaPerdidaPage),
  },

  // ── Términos y privacidad (públicas, enlazadas desde el registro) ───────
  {
    path: 'terminos',
    loadComponent: () =>
      import('./terminos/terminos.component').then((m) => m.TerminosComponent),
  },
  {
    path: 'privacidad',
    loadComponent: () =>
      import('./privacidad/privacidad.component').then((m) => m.PrivacidadComponent),
  },

  // ── Rutas protegidas (con tabs) ──────────────────────────────────────────
  {
    path: 'tabs',
    component: TabsComponent,
    canActivate: [authGuard, perfilCompletoGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./home/home.component').then((m) => m.HomePage),
      },
      {
        path: 'listar-mascotas',
        canActivate: [noVeterinarioGuard],
        loadComponent: () =>
          import('./listar-mascotas/listar-mascotas.component').then(
            (m) => m.ListarMascotasComponent
          ),
      },
      {
        path: 'buscador',
        loadComponent: () =>
          import('./buscador/buscador.component').then((m) => m.BuscadorComponent),
      },
      {
        path: 'crear-mascotas',
        canActivate: [noVeterinarioGuard],
        loadComponent: () =>
          import('./crear-mascotas/crear-mascotas.component').then(
            (m) => m.CrearMascotasComponent
          ),
      },
      {
        path: 'mascota-qr',
        loadComponent: () =>
          import('./mascota-qr/mascota-qr.component').then((m) => m.MascotaQrComponent),
      },
      {
        path: 'perfil',
        loadComponent: () =>
          import('./perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./configuracion/configuracion.component').then(
            (m) => m.ConfiguracionComponent
          ),
      },
      {
        path: 'guia',
        loadComponent: () =>
          import('./guia/guia.component').then((m) => m.GuiaComponent),
      },
      {
        path: 'mis-publicaciones',
        loadComponent: () =>
          import('./mis-publicaciones/mis-publicaciones.component').then(
            (m) => m.MisPublicacionesComponent
          ),
      },
      {
        path: 'notificaciones',
        loadComponent: () =>
          import('./notificaciones/notificaciones.component').then(
            (m) => m.NotificacionesComponent
          ),
      },
      {
        path: 'publicacion/:id',
        loadComponent: () =>
          import('./publicacion-detalle/publicacion-detalle.component').then(
            (m) => m.PublicacionDetalleComponent
          ),
      },
      {
        path: 'perfil-mascota/:id',
        loadComponent: () =>
          import('./perfil-mascota/perfil-mascota.component').then(
            (m) => m.MascotaPerfilComponent
          ),
      },
      {
        path: 'mascota-editar/:id/editar',
        loadComponent: () =>
          import('./mascota-editar/mascota-editar.component').then(
            (m) => m.MascotaEditarComponent
          ),
      },
      {
        path: 'mascota-detalle/:id',
        loadComponent: () =>
          import('./mascota-detalle/mascota-detalle.component')
            .then(m => m.MascotaDetalleComponent),
      },
      // Sin uid: es la ruta a la que el tab-bar navega SIEMPRE al tocar
      // "Refugio" (Ionic solo conoce tabsPrefix + tab, nunca el href
      // dinámico del botón) — el propio componente resuelve a qué refugio
      // corresponde y redirige a la ruta con uid.
      {
        path: 'refugio-panel',
        loadComponent: () =>
          import('./refugio-panel/refugio-panel.component')
            .then(m => m.RefugioPanelComponent),
      },
      {
        path: 'refugio-panel/:refugioUid',
        loadComponent: () =>
          import('./refugio-panel/refugio-panel.component')
            .then(m => m.RefugioPanelComponent),
      },
      {
        path: 'refugio-finanzas/:refugioUid',
        loadComponent: () =>
          import('./refugio-finanzas/refugio-finanzas.component')
            .then(m => m.RefugioFinanzasComponent),
      },
      {
        path: 'refugio-chat/:refugioUid',
        loadComponent: () =>
          import('./refugio-chat/refugio-chat.component')
            .then(m => m.RefugioChatComponent),
      },
      {
        path: 'mis-chats',
        loadComponent: () =>
          import('./mis-chats/mis-chats.component')
            .then(m => m.MisChatsComponent),
      },
      {
        path: 'chat-directo/:chatId',
        loadComponent: () =>
          import('./chat-directo/chat-directo.component')
            .then(m => m.ChatDirectoComponent),
      },
      {
        path: 'veterinario-panel',
        loadComponent: () =>
          import('./veterinario-panel/veterinario-panel.component')
            .then(m => m.VeterinarioPanelComponent),
      },
      {
        path: 'servicio-panel',
        loadComponent: () =>
          import('./servicio-panel/servicio-panel.component')
            .then(m => m.ServicioPanelComponent),
      },
      {
        path: 'pyme-panel',
        loadComponent: () =>
          import('./pyme-panel/pyme-panel.component')
            .then(m => m.PymePanelComponent),
      },
      // ── Chat IA dentro de tabs (mantiene navbar) ─────────────────────────
      {
        path: 'chat-ia',
        loadComponent: () =>
          import('./chat-ia/chat-ia.component').then((m) => m.ChatIaComponent),
      },
      // Panel admin (solo cuenta de Ashbis): aprobar/rechazar veterinarios.
      {
        path: 'admin-veterinarios',
        canActivate: [adminGuard],
        loadComponent: () =>
          import('./admin-veterinarios/admin-veterinarios.component')
            .then(m => m.AdminVeterinariosComponent),
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
    ],
  },

  // ── Fallbacks ─────────────────────────────────────────────────────────────
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
  {
    path: '**',
    redirectTo: 'login',
  },
];