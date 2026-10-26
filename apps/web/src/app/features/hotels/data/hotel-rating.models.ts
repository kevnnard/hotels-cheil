export interface RateHotelRequest {
  readonly score: number;
}

export interface OwnRatingResponse {
  readonly score: number | null;
}
