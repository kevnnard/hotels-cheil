import { describe, expect, it } from 'vitest';
import { HotelAddress } from './hotel.models';
import { formatCityRegion, formatLocation } from './hotel-location';

const address = (overrides: Partial<HotelAddress>): HotelAddress => ({
  street: null,
  city: null,
  region: null,
  country: null,
  postalCode: null,
  ...overrides,
});

describe('formatCityRegion', () => {
  it('joins a city and a different region with a bullet', () => {
    expect(formatCityRegion(address({ city: 'Cusco', region: 'Sacred Valley' }))).toBe('Cusco • Sacred Valley');
  });

  it('shows one name when the city and the region are the same', () => {
    expect(formatCityRegion(address({ city: 'Lima', region: 'Lima' }))).toBe('Lima');
  });

  it('ignores letter case when comparing the city and the region', () => {
    expect(formatCityRegion(address({ city: 'Lima', region: 'LIMA' }))).toBe('Lima');
  });

  it('keeps whichever part exists and is empty when neither does', () => {
    expect(formatCityRegion(address({ city: 'Kyoto' }))).toBe('Kyoto');
    expect(formatCityRegion(address({ region: 'Kyoto Prefecture' }))).toBe('Kyoto Prefecture');
    expect(formatCityRegion(address({}))).toBe('');
  });
});

describe('formatLocation', () => {
  it('joins the city and the country with a comma', () => {
    expect(formatLocation(address({ city: 'Lima', country: 'Peru' }))).toBe('Lima, Peru');
  });
});
