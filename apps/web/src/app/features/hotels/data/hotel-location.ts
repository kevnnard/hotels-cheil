import { HotelAddress } from './hotel.models';

function joinParts(parts: (string | null)[], separator: string): string {
  return parts.filter((part): part is string => !!part).join(separator);
}

export function formatLocation(address: HotelAddress): string {
  return joinParts([address.city, address.country], ', ');
}

export function formatCityRegion(address: HotelAddress): string {
  return joinParts([address.city, address.region], ' • ');
}
