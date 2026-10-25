import { Routes } from '@angular/router';

export const hotelsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./catalog/catalog-page').then((module) => module.CatalogPage),
  },
  {
    path: 'hotels/:id',
    loadComponent: () => import('./detail/hotel-detail-page').then((module) => module.HotelDetailPage),
  },
];
