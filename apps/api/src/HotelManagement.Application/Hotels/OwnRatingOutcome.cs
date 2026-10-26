namespace HotelManagement.Application.Hotels;

public enum OwnRatingStatus
{
    Found,
    HotelNotFound
}

public sealed record OwnRatingOutcome(OwnRatingStatus Status, decimal? Score = null)
{
    public static OwnRatingOutcome Found(decimal? score) => new(OwnRatingStatus.Found, score);

    public static OwnRatingOutcome HotelNotFound() => new(OwnRatingStatus.HotelNotFound);
}
