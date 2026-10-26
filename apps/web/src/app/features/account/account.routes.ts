import { Routes } from '@angular/router';
import { visitorGuestGuard } from '../../core/auth/auth.guards';

export const accountRoutes: Routes = [
  {
    path: 'sign-in',
    canActivate: [visitorGuestGuard],
    loadComponent: () => import('./sign-in-page').then((module) => module.SignInPage),
  },
  {
    path: 'register',
    canActivate: [visitorGuestGuard],
    loadComponent: () => import('./register-page').then((module) => module.RegisterPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },
];
