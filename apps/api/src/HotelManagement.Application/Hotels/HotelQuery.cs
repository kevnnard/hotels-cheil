using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Hotels;

public sealed record HotelQuery
{
    public const int DefaultPageSize = 20;
    public const int MaximumPageSize = 100;

    public string? Name { get; init; }

    public decimal? MinimumRating { get; init; }

    public decimal? MaximumPrice { get; init; }

    public bool ActiveOnly { get; init; }

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = DefaultPageSize;

    public bool IsValid =>
        Page >= 1
        && PageSize >= 1
        && PageSize <= MaximumPageSize
        && (MinimumRating is null || (MinimumRating >= RatingScore.Minimum && MinimumRating <= RatingScore.Maximum))
        && (MaximumPrice is null || MaximumPrice > 0);
}
