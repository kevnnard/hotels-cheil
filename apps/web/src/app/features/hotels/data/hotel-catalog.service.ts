import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { hotelListParams } from './hotel-list-params';
import { Hotel, HotelListQuery, HotelPage } from './hotel.models';

const publicHotelsUrl = '/api/public/hotels';

@Injectable({ providedIn: 'root' })
export class HotelCatalogService {
  private readonly http = inject(HttpClient);

  list(query: HotelListQuery): Observable<HotelPage> {
    return this.http.get<HotelPage>(publicHotelsUrl, { params: hotelListParams(query) });
  }

  get(id: string): Observable<Hotel> {
    return this.http.get<Hotel>(`${publicHotelsUrl}/${id}`);
  }

  imageUrl(id: string): string {
    return `${publicHotelsUrl}/${id}/image`;
  }

  imagePositionUrl(id: string, position: number): string {
    return `${publicHotelsUrl}/${id}/images/${position}`;
  }
}
