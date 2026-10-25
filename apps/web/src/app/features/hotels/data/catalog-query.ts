import { ParamMap } from '@angular/router';
import { HotelListQuery } from './hotel.models';

export const catalogPageSize = 8;

export interface RatingOption {
  value: number;
  label: string;
}

export const ratingOptions: readonly RatingOption[] = [
  { value: 4.9, label: '4.90+' },
  { value: 4.95, label: '4.95+' },
  { value: 5, label: '5.0 ★' },
];

function positiveInteger(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed >= 1 ? parsed : null;
}

function minimumRating(value: string | null): number | null {
  if (value === null || !/^\d(\.\d+)?$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed >= 1 && parsed <= 5 ? parsed : null;
}

export function parseCatalogQuery(params: ParamMap): HotelListQuery {
  return {
    name: params.get('name') ?? '',
    minRating: minimumRating(params.get('minRating')),
    page: positiveInteger(params.get('page')) ?? 1,
    pageSize: catalogPageSize,
  };
}
