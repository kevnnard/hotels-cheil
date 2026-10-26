import { Routes } from '@angular/router';

export const adminRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./dashboard-page').then((module) => module.DashboardPage),
    children: [
      {
        path: 'hotels/new',
        loadComponent: () => import('./hotel-sheet-page').then((module) => module.HotelSheetPage),
      },
      {
        path: 'hotels/:id/edit',
        loadComponent: () => import('./hotel-sheet-page').then((module) => module.HotelSheetPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
