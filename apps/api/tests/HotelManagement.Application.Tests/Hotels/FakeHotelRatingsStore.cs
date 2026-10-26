using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Tests.Hotels;

internal sealed class FakeHotelRatingsStore : IHotelRatingsStore
{
    private readonly Dictionary<Guid, RatingSummary> summaries = [];
    private readonly Dictionary<(Guid HotelId, Guid UserId), decimal> scores = [];

    public List<(Guid HotelId, Guid UserId, decimal Score)> Rated { get; } = [];

    public List<(Guid HotelId, Guid UserId)> ScoreLookups { get; } = [];

    public int SummaryLookups { get; private set; }

    public RatingSummary? RateResult { get; set; }

    public void Seed(Guid hotelId, RatingSummary summary) => summaries[hotelId] = summary;

    public void SeedScore(Guid hotelId, Guid userId, decimal score) => scores[(hotelId, userId)] = score;

    public Task<RatingSummary?> GetSummaryAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        SummaryLookups++;
        return Task.FromResult(summaries.GetValueOrDefault(hotelId));
    }

    public Task<decimal?> FindScoreAsync(Guid hotelId, Guid userId, CancellationToken cancellationToken)
    {
        ScoreLookups.Add((hotelId, userId));
        return Task.FromResult(scores.TryGetValue((hotelId, userId), out var score) ? score : (decimal?)null);
    }

    public Task<RatingSummary?> RateAsync(Guid hotelId, Guid userId, decimal score, CancellationToken cancellationToken)
    {
        Rated.Add((hotelId, userId, score));
        return Task.FromResult(RateResult);
    }
}
