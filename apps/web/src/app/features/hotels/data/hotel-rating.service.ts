import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { OwnRatingResponse, RateHotelRequest } from './hotel-rating.models';
import { HotelRating } from './hotel.models';

function ratingsUrl(hotelId: string): string {
  return `/api/hotels/${encodeURIComponent(hotelId)}/ratings`;
}

@Injectable({ providedIn: 'root' })
export class HotelRatingService {
  private readonly http = inject(HttpClient);

  rate(hotelId: string, score: number): Observable<HotelRating> {
    const body: RateHotelRequest = { score };
    return this.http.post<HotelRating>(ratingsUrl(hotelId), body);
  }

  ownScore(hotelId: string): Observable<number | null> {
    return this.http.get<OwnRatingResponse>(`${ratingsUrl(hotelId)}/me`).pipe(map(({ score }) => score));
  }
}
