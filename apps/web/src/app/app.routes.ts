import { Routes } from '@angular/router';
import { administratorGuard, authenticatedGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: 'admin',
    children: [
      {
        path: 'login',
        canActivate: [guestGuard],
        loadChildren: () => import('./features/auth/auth.routes').then((module) => module.authRoutes),
      },
      {
        path: '',
        canActivate: [authenticatedGuard, administratorGuard],
        loadComponent: () => import('./layouts/admin-layout').then((module) => module.AdminLayout),
        loadChildren: () => import('./features/admin/admin.routes').then((module) => module.adminRoutes),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./layouts/public-layout').then((module) => module.PublicLayout),
    children: [
      {
        path: 'account',
        loadChildren: () => import('./features/account/account.routes').then((module) => module.accountRoutes),
      },
      {
        path: '',
        loadChildren: () => import('./features/hotels/hotels.routes').then((module) => module.hotelsRoutes),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
