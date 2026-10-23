using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Hotels;

public enum RateHotelStatus
{
    Rated,
    HotelNotFound,
    InvalidInput
}

public sealed record RateHotelOutcome(RateHotelStatus Status, RatingSummary? Rating = null, string? InvalidField = null, string? Message = null)
{
    public static RateHotelOutcome Rated(RatingSummary rating) => new(RateHotelStatus.Rated, rating);

    public static RateHotelOutcome HotelNotFound() => new(RateHotelStatus.HotelNotFound);

    public static RateHotelOutcome InvalidInput(string field, string message) =>
        new(RateHotelStatus.InvalidInput, null, field, message);
}
