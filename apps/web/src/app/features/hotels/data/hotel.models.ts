export interface HotelAddress {
  street: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
}

export interface HotelContact {
  phone: string | null;
  email: string | null;
  website: string | null;
}

export interface HotelRating {
  sum: number;
  count: number;
  average: number | null;
}

export interface HotelImage {
  contentType: string;
  width: number;
  height: number;
  sizeBytes: number;
}

export interface HotelGalleryImage extends HotelImage {
  position: number;
}

export interface HotelPricing {
  currency: 'USD';
  nightlyRate: number;
  discountPercent: number | null;
  discountedNightlyRate: number | null;
}

export interface Hotel {
  id: string;
  name: string;
  description: string | null;
  address: HotelAddress;
  contact: HotelContact;
  isActive: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
  rating: HotelRating;
  image: HotelImage | null;
  images: HotelGalleryImage[];
  pricing: HotelPricing | null;
}

export interface HotelPage {
  items: Hotel[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface HotelListQuery {
  name: string;
  minRating: number | null;
  maxPrice?: number | null;
  page: number;
  pageSize: number;
}
