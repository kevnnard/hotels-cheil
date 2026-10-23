using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Tests.Hotels;

internal sealed class FakeHotelRatingsStore : IHotelRatingsStore
{
    private readonly Dictionary<Guid, RatingSummary> summaries = [];

    public List<(Guid HotelId, Guid UserId, decimal Score)> Rated { get; } = [];

    public int SummaryLookups { get; private set; }

    public RatingSummary? RateResult { get; set; }

    public void Seed(Guid hotelId, RatingSummary summary) => summaries[hotelId] = summary;

    public Task<RatingSummary?> GetSummaryAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        SummaryLookups++;
        return Task.FromResult(summaries.GetValueOrDefault(hotelId));
    }

    public Task<RatingSummary?> RateAsync(Guid hotelId, Guid userId, decimal score, CancellationToken cancellationToken)
    {
        Rated.Add((hotelId, userId, score));
        return Task.FromResult(RateResult);
    }
}
