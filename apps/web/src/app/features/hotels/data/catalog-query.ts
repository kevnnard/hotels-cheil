import { ParamMap } from '@angular/router';
import { HotelListQuery } from './hotel.models';

export const catalogPageSize = 8;

export const priceRange = { min: 50, max: 1000, step: 50 } as const;

export interface RatingOption {
  value: number;
  label: string;
}

function ratingOption(value: number): RatingOption {
  return { value, label: `${Number.isInteger(value) ? value.toFixed(1) : value}+` };
}

export const ratingOptions: readonly RatingOption[] = [3, 3.5, 4, 4.5, 4.9].map(ratingOption);

export function ratingChoices(selected: number | null): readonly RatingOption[] {
  if (selected === null || ratingOptions.some((option) => option.value === selected)) {
    return ratingOptions;
  }
  return [...ratingOptions, ratingOption(selected)].sort((left, right) => left.value - right.value);
}

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

function maximumPrice(value: string | null): number | null {
  if (value === null || !/^\d+(\.\d+)?$/.test(value)) {
    return null;
  }
  const parsed = Number(value);
  return parsed > 0 ? parsed : null;
}

export function parseCatalogQuery(params: ParamMap, pageSize: number = catalogPageSize): HotelListQuery {
  return {
    name: params.get('name') ?? '',
    minRating: minimumRating(params.get('minRating')),
    maxPrice: maximumPrice(params.get('maxPrice')),
    page: positiveInteger(params.get('page')) ?? 1,
    pageSize,
  };
}
