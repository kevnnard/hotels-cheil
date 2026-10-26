import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { hotelListParams } from '../../hotels/data/hotel-list-params';
import { Hotel, HotelImage, HotelListQuery, HotelPage } from '../../hotels/data/hotel.models';
import { HotelRequest, ImagePosition } from './admin-hotel.models';

const adminHotelsUrl = '/api/hotels';
const imageField = 'image';

function hotelUrl(id: string): string {
  return `${adminHotelsUrl}/${encodeURIComponent(id)}`;
}

function imageUrl(id: string, position: ImagePosition): string {
  return `${hotelUrl(id)}/images/${position}`;
}

@Injectable({ providedIn: 'root' })
export class AdminHotelsService {
  private readonly http = inject(HttpClient);

  list(query: HotelListQuery): Observable<HotelPage> {
    return this.http.get<HotelPage>(adminHotelsUrl, { params: hotelListParams(query) });
  }

  get(id: string): Observable<Hotel> {
    return this.http.get<Hotel>(hotelUrl(id));
  }

  create(request: HotelRequest): Observable<Hotel> {
    return this.http.post<Hotel>(adminHotelsUrl, request);
  }

  update(id: string, request: HotelRequest): Observable<Hotel> {
    return this.http.put<Hotel>(hotelUrl(id), request);
  }

  setActive(id: string, isActive: boolean): Observable<Hotel> {
    return this.http.put<Hotel>(`${hotelUrl(id)}/status`, { isActive });
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(hotelUrl(id));
  }

  uploadImage(id: string, position: ImagePosition, file: File): Observable<HotelImage> {
    const body = new FormData();
    body.append(imageField, file, file.name);
    return this.http.put<HotelImage>(imageUrl(id, position), body);
  }

  deleteImage(id: string, position: ImagePosition): Observable<void> {
    return this.http.delete<void>(imageUrl(id, position));
  }
}
