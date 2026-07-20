import { Routes } from '@angular/router';
import { authGuard, publicGuard } from './guards/auth.guard';
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
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () =>
          import('./home/home.component').then((m) => m.HomePage),
      },
      {
        path: 'listar-mascotas',
        loadComponent: () =>
          import('./listar-mascotas/listar-mascotas.component').then(
            (m) => m.ListarMascotasComponent
          ),
      },
      {
        path: 'crear-mascotas',
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
      // ── Chat IA dentro de tabs (mantiene navbar) ─────────────────────────
      {
        path: 'chat-ia',
        loadComponent: () =>
          import('./chat-ia/chat-ia.component').then((m) => m.ChatIaComponent),
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