import { ParamMap } from '@angular/router';
import { parseCatalogQuery, RatingOption } from '../../hotels/data/catalog-query';
import { HotelListQuery } from '../../hotels/data/hotel.models';

export const adminPageSize = 10;

export const adminRatingOptions: readonly RatingOption[] = [
  { value: 3, label: '3.0 and up' },
  { value: 4, label: '4.0 and up' },
  { value: 4.5, label: '4.5 and up' },
  { value: 4.9, label: '4.9 and up' },
];

export function parseAdminHotelQuery(params: ParamMap): HotelListQuery {
  return parseCatalogQuery(params, adminPageSize);
}

export function sameHotelQuery(left: HotelListQuery, right: HotelListQuery): boolean {
  return (
    left.name === right.name &&
    left.minRating === right.minRating &&
    (left.maxPrice ?? null) === (right.maxPrice ?? null) &&
    left.page === right.page &&
    left.pageSize === right.pageSize
  );
}
