import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { TabsComponent } from './tabs/tabs.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./auth/pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'registro',
    loadComponent: () =>
      import('./auth/pages/registro/registro.component').then((m) => m.RegistroComponent),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./auth/pages/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'tabs',
    component: TabsComponent,
    canActivate: [authGuard],
    children: [
      {
        path: 'home',
        loadComponent: () => import('./home/home.component').then((m) => m.HomePage),
      },
      {
        path: 'listar-mascotas',
        loadComponent: () => import('./listar-mascotas/listar-mascotas.component').then((m) => m.ListarMascotasComponent),
      },
      {
        path: 'crear-mascotas',
        loadComponent: () => import('./crear-mascotas/crear-mascotas.component').then((m) => m.CrearMascotasComponent),
      },
      {
        path: 'mascota-qr',
        loadComponent: () => import('./mascota-qr/mascota-qr.component').then(m => m.MascotaQrComponent)
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.component').then((m) => m.PerfilComponent),
      },
      {
        path: 'perfil-mascota/:id',
        loadComponent: () => import('./perfil-mascota/perfil-mascota.component').then((m) => m.MascotaPerfilComponent),
      },
      {
        path: 'mascota-editar/:id/editar',
        loadComponent: () => import('./mascota-editar/mascota-editar.component').then((m) => m.MascotaEditarComponent),
      },
      {
        path: 'mascota-detalle/:id', // :id es el parámetro dinámico
        loadComponent: () => import('./pages/mascota-detalle/mascota-detalle.component')
          .then(m => m.MascotaDetalleComponent)
      },
      {
        path: '',
        redirectTo: '/tabs/home',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'chat-ia',
    loadComponent: () => 
      import('./chat-ia/chat-ia.component')
    .then(m => m.ChatIaComponent)
  },
  {
    path: 'carnet/:id',
    loadComponent: () => 
      import('./carnet-mascota/carnet-mascota.page')
      .then(m => m.CarnetMascotaPage)
  },
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full',
  },
 
  {
    path: '**',
    redirectTo: 'login',
  }
];
