import { convertToParamMap } from '@angular/router';
import { adminPageSize, adminRatingOptions, parseAdminHotelQuery } from './admin-hotel-query';

function parse(params: Record<string, string>) {
  return parseAdminHotelQuery(convertToParamMap(params));
}

describe('parseAdminHotelQuery', () => {
  it('reads the name, rating, price limit and page from the address with the admin page size', () => {
    expect(parse({ name: 'sea', minRating: '4.5', maxPrice: '300', page: '3' })).toEqual({
      name: 'sea',
      minRating: 4.5,
      maxPrice: 300,
      page: 3,
      pageSize: adminPageSize,
    });
  });

  it('falls back to the first page and no filters for missing or invalid values', () => {
    expect(parse({ minRating: '9', maxPrice: '-4', page: '0' })).toEqual({
      name: '',
      minRating: null,
      maxPrice: null,
      page: 1,
      pageSize: adminPageSize,
    });
  });

  it('pages ten hotels at a time', () => {
    expect(adminPageSize).toBe(10);
  });

  it('offers minimum rating thresholds within the API range', () => {
    expect(adminRatingOptions.map((option) => option.value)).toEqual([3, 4, 4.5, 4.9]);
    expect(adminRatingOptions.every((option) => option.value >= 1 && option.value <= 5)).toBe(true);
  });
});
