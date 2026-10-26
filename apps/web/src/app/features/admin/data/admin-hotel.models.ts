import { Hotel } from '../../hotels/data/hotel.models';

export const hotelTextFields = [
  'name',
  'description',
  'street',
  'city',
  'region',
  'country',
  'postalCode',
  'phone',
  'email',
  'website',
] as const;

export const hotelNumberFields = ['pricePerNight', 'discountPercent'] as const;

export const hotelFields = [...hotelTextFields, ...hotelNumberFields] as const;

export type HotelTextField = (typeof hotelTextFields)[number];
export type HotelNumberField = (typeof hotelNumberFields)[number];
export type HotelField = (typeof hotelFields)[number];

export type HotelRequest = Record<HotelTextField, string | null> & Record<HotelNumberField, number | null> & { name: string };

export type HotelFormValue = Record<HotelTextField, string> & Record<HotelNumberField, number | null>;

export type HotelFieldErrors = Partial<Record<HotelField, string>>;

export interface FormAlert {
  readonly message: string;
  readonly details: readonly string[];
  readonly retryable: boolean;
}

export interface VisibilityFailure {
  readonly message: string;
  readonly retryable: boolean;
}

export interface VisibilityState {
  readonly active: boolean;
  readonly saving: boolean;
  readonly message: string | null;
  readonly failure: VisibilityFailure | null;
}

export interface HotelFailure extends FormAlert {
  readonly fieldErrors: HotelFieldErrors;
}

export const imagePositions = [0, 1, 2] as const;

export type ImagePosition = (typeof imagePositions)[number];

export type ImageSlotStatus = 'idle' | 'uploading' | 'removing';

export interface ImageSlotState {
  readonly position: ImagePosition;
  readonly hasImage: boolean;
  readonly version: number;
  readonly status: ImageSlotStatus;
  readonly error: string | null;
  readonly message: string | null;
  readonly pendingFile: File | null;
}

export function emptyImageSlots(): readonly ImageSlotState[] {
  return imagePositions.map((position) => ({
    position,
    hasImage: false,
    version: 0,
    status: 'idle',
    error: null,
    message: null,
    pendingFile: null,
  }));
}

export function imageSlotsOf(hotel: Hotel): readonly ImageSlotState[] {
  return emptyImageSlots().map((slot) => ({
    ...slot,
    hasImage: hotel.images.some((image) => image.position === slot.position),
  }));
}

export function imageSlotName(position: ImagePosition): string {
  return position === 0 ? 'main image' : `image ${position + 1}`;
}
