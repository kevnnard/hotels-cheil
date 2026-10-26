using HotelManagement.Domain.Ratings;

namespace HotelManagement.Api.Hotels;

public sealed record RateHotelRequest(decimal Score);

public sealed record OwnRatingResponse(decimal? Score);

public sealed record RatingSummaryResponse(decimal Sum, int Count, decimal? Average)
{
    public static RatingSummaryResponse From(RatingSummary rating) =>
        new(rating.Sum, rating.Count, rating.Average);
}
