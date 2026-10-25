import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { Hotel, HotelListQuery, HotelPage } from './hotel.models';

const publicHotelsUrl = '/api/public/hotels';

@Injectable({ providedIn: 'root' })
export class HotelCatalogService {
  private readonly http = inject(HttpClient);

  list(query: HotelListQuery): Observable<HotelPage> {
    let params = new HttpParams().set('page', query.page).set('pageSize', query.pageSize);
    const name = query.name.trim();
    if (name) {
      params = params.set('name', name);
    }
    if (query.minRating !== null) {
      params = params.set('minRating', query.minRating);
    }
    return this.http.get<HotelPage>(publicHotelsUrl, { params });
  }

  get(id: string): Observable<Hotel> {
    return this.http.get<Hotel>(`${publicHotelsUrl}/${id}`);
  }

  imageUrl(id: string): string {
    return `${publicHotelsUrl}/${id}/image`;
  }
}
