import { HttpParams } from '@angular/common/http';
import { HotelListQuery } from './hotel.models';

export function hotelListParams(query: HotelListQuery): HttpParams {
  let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
  const name = query.name.trim();
  if (name) {
    params = params.set('name', name);
  }
  if (query.minRating !== null) {
    params = params.set('minRating', query.minRating);
  }
  const maxPrice = query.maxPrice ?? null;
  if (maxPrice !== null && maxPrice > 0) {
    params = params.set('maxPrice', maxPrice);
  }
  return params;
}
