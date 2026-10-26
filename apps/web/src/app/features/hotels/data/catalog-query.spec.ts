import { convertToParamMap } from '@angular/router';
import { parseCatalogQuery, ratingChoices, ratingOptions } from './catalog-query';

function parse(params: Record<string, string>) {
  return parseCatalogQuery(convertToParamMap(params));
}

describe('parseCatalogQuery', () => {
  it('keeps decimal minimum ratings exactly', () => {
    expect(parse({ minRating: '4.9' }).minRating).toBe(4.9);
    expect(parse({ minRating: '4.95' }).minRating).toBe(4.95);
    expect(parse({ minRating: '4.90' }).minRating).toBe(4.9);
    expect(parse({ minRating: '5.0' }).minRating).toBe(5);
    expect(parse({ minRating: '5' }).minRating).toBe(5);
  });

  it('keeps integer minimum ratings within the supported range', () => {
    expect(parse({ minRating: '1' }).minRating).toBe(1);
    expect(parse({ minRating: '4' }).minRating).toBe(4);
  });

  it('ignores minimum ratings outside 1 to 5 or not numeric', () => {
    for (const value of ['0', '0.9', '5.01', '6', '-4', 'abc', '4,9', '4.', '.9', '4.9.1', '']) {
      expect(parse({ minRating: value }).minRating).toBeNull();
    }
    expect(parse({}).minRating).toBeNull();
  });

  it('offers broad minimum rating thresholds from 3.0 to 4.9', () => {
    expect(ratingOptions.map((option) => option.value)).toEqual([3, 3.5, 4, 4.5, 4.9]);
    expect(ratingOptions.map((option) => option.label)).toEqual(['3.0+', '3.5+', '4.0+', '4.5+', '4.9+']);
  });

  it('offers exactly the thresholds when no rating or a listed rating is selected', () => {
    expect(ratingChoices(null)).toEqual(ratingOptions);
    for (const option of ratingOptions) {
      expect(ratingChoices(option.value)).toEqual(ratingOptions);
    }
  });

  it('adds a selected rating outside the thresholds as one extra choice in sorted order', () => {
    expect(ratingChoices(4.95).map((option) => [option.value, option.label])).toEqual([
      [3, '3.0+'],
      [3.5, '3.5+'],
      [4, '4.0+'],
      [4.5, '4.5+'],
      [4.9, '4.9+'],
      [4.95, '4.95+'],
    ]);
    expect(ratingChoices(5).at(-1)).toEqual({ value: 5, label: '5.0+' });
    expect(ratingChoices(2)[0]).toEqual({ value: 2, label: '2.0+' });
    expect(ratingChoices(3.75).map((option) => option.value)).toEqual([3, 3.5, 3.75, 4, 4.5, 4.9]);
    expect(ratingChoices(3.75)[2].label).toBe('3.75+');
  });

  it('keeps positive maximum prices, including decimals', () => {
    expect(parse({ maxPrice: '300' }).maxPrice).toBe(300);
    expect(parse({ maxPrice: '50' }).maxPrice).toBe(50);
    expect(parse({ maxPrice: '199.99' }).maxPrice).toBe(199.99);
    expect(parse({ maxPrice: '0.5' }).maxPrice).toBe(0.5);
  });

  it('ignores maximum prices that are zero, negative or not numeric', () => {
    for (const value of ['0', '0.0', '-50', 'abc', '3,5', '300.', '.5', '1e3', '']) {
      expect(parse({ maxPrice: value }).maxPrice).toBeNull();
    }
    expect(parse({}).maxPrice).toBeNull();
  });

  it('falls back to the first page for invalid pages', () => {
    expect(parse({ page: '-3' }).page).toBe(1);
    expect(parse({ page: '0' }).page).toBe(1);
    expect(parse({ page: '2' }).page).toBe(2);
  });

  it('uses the catalog page size unless another one is given', () => {
    expect(parse({}).pageSize).toBe(8);
    expect(parseCatalogQuery(convertToParamMap({}), 10).pageSize).toBe(10);
  });
});
