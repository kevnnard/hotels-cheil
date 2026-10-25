import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-page').then((module) => module.DashboardPage),
  },
  { path: '**', redirectTo: '' },
];
