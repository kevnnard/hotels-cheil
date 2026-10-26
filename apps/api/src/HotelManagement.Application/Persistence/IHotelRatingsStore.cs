using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Persistence;

public interface IHotelRatingsStore
{
    Task<RatingSummary?> GetSummaryAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<decimal?> FindScoreAsync(Guid hotelId, Guid userId, CancellationToken cancellationToken);

    Task<RatingSummary?> RateAsync(Guid hotelId, Guid userId, decimal score, CancellationToken cancellationToken);
}
