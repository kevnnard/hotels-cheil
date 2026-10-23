using HotelManagement.Domain;
using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Ratings;
using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelRatingPersistenceTests(PostgresDatabaseFixture database)
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private async Task<Guid> StoreNewHotelAsync()
    {
        var hotel = Hotel.Create(new HotelDetails("Rated Hotel"), CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel.Id;
    }

    private Task<RatingSummary?> RateAsync(Guid hotelId, Guid userId, decimal score) =>
        database.CreateRatingStore().RateAsync(hotelId, userId, score, CancellationToken.None);

    private async Task<RatingSummary> SummaryAsync(Guid hotelId) =>
        (await database.CreateRatingStore().GetSummaryAsync(hotelId, CancellationToken.None))!;

    [Fact]
    public async Task HotelWithoutRatings_HasNoAverageAndZeroCount()
    {
        var hotelId = await StoreNewHotelAsync();

        var summary = await SummaryAsync(hotelId);

        Assert.Equal(0, summary.Count);
        Assert.Equal(0m, summary.Sum);
        Assert.Null(summary.Average);
    }

    [Fact]
    public async Task UnknownHotel_HasNoSummaryAndCannotBeRated()
    {
        var missing = Guid.NewGuid();

        Assert.Null(await database.CreateRatingStore().GetSummaryAsync(missing, CancellationToken.None));
        Assert.Null(await RateAsync(missing, Guid.NewGuid(), 3m));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task BoundaryScores_AreAccepted(int score)
    {
        var hotelId = await StoreNewHotelAsync();

        var summary = await RateAsync(hotelId, Guid.NewGuid(), score);

        Assert.NotNull(summary);
        Assert.Equal(1, summary.Count);
        Assert.Equal(score, summary.Average);
    }

    [Fact]
    public async Task FractionalScores_AreStoredWithoutRounding()
    {
        var hotelId = await StoreNewHotelAsync();

        await RateAsync(hotelId, Guid.NewGuid(), 2.123456789m);
        await RateAsync(hotelId, Guid.NewGuid(), 4.5m);

        var summary = await SummaryAsync(hotelId);
        Assert.Equal(2, summary.Count);
        Assert.Equal(6.623456789m, summary.Sum);
        Assert.Equal(6.623456789m / 2, summary.Average);
    }

    [Fact]
    public async Task DistinctUsers_AreCountedSeparately()
    {
        var hotelId = await StoreNewHotelAsync();

        await RateAsync(hotelId, Guid.NewGuid(), 5m);
        await RateAsync(hotelId, Guid.NewGuid(), 4m);
        await RateAsync(hotelId, Guid.NewGuid(), 3m);

        var summary = await SummaryAsync(hotelId);
        Assert.Equal(3, summary.Count);
        Assert.Equal(4m, summary.Average);
    }

    [Fact]
    public async Task RepeatingTheSameRating_DoesNotAddAVote()
    {
        var hotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();

        await RateAsync(hotelId, userId, 4m);
        var repeated = await RateAsync(hotelId, userId, 4m);

        Assert.NotNull(repeated);
        Assert.Equal(1, repeated.Count);
        Assert.Equal(4m, repeated.Average);
    }

    [Fact]
    public async Task ChangingARating_ReplacesItAndKeepsTheCount()
    {
        var hotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();
        await RateAsync(hotelId, Guid.NewGuid(), 5m);
        await RateAsync(hotelId, userId, 1m);

        var changed = await RateAsync(hotelId, userId, 3m);

        Assert.NotNull(changed);
        Assert.Equal(2, changed.Count);
        Assert.Equal(8m, changed.Sum);
        Assert.Equal(4m, changed.Average);
    }

    [Theory]
    [InlineData(0.99)]
    [InlineData(5.01)]
    [InlineData(0)]
    [InlineData(-3)]
    public async Task OutOfRangeScores_AreRejectedAndStoredRatingsStayUntouched(double invalid)
    {
        var hotelId = await StoreNewHotelAsync();
        var otherHotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();
        await RateAsync(hotelId, userId, 2m);
        await RateAsync(otherHotelId, userId, 5m);

        await Assert.ThrowsAsync<DomainValidationException>(() => RateAsync(hotelId, userId, (decimal)invalid));
        await Assert.ThrowsAsync<DomainValidationException>(() => RateAsync(hotelId, Guid.NewGuid(), (decimal)invalid));

        var summary = await SummaryAsync(hotelId);
        Assert.Equal(1, summary.Count);
        Assert.Equal(2m, summary.Average);
        Assert.Equal(5m, (await SummaryAsync(otherHotelId)).Average);
    }

    [Fact]
    public async Task EmptyUser_IsRejectedAndStoresNothing()
    {
        var hotelId = await StoreNewHotelAsync();

        await Assert.ThrowsAsync<DomainValidationException>(() => RateAsync(hotelId, Guid.Empty, 3m));

        Assert.Equal(0, (await SummaryAsync(hotelId)).Count);
    }

    [Fact]
    public async Task RatingsOfOtherHotelsAndUsers_AreNotAffectedByAnUpdate()
    {
        var hotelId = await StoreNewHotelAsync();
        var otherHotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();
        await RateAsync(hotelId, userId, 1m);
        await RateAsync(hotelId, Guid.NewGuid(), 5m);
        await RateAsync(otherHotelId, userId, 2m);

        await RateAsync(hotelId, userId, 4m);

        Assert.Equal(9m, (await SummaryAsync(hotelId)).Sum);
        Assert.Equal(2m, (await SummaryAsync(otherHotelId)).Sum);
    }

    [Fact]
    public async Task SimultaneousRatingsFromOneUser_LeaveASingleVote()
    {
        var hotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();
        var otherUserId = Guid.NewGuid();
        await RateAsync(hotelId, otherUserId, 5m);
        decimal[] attempts = [1m, 2m, 3m, 4m, 5m, 1.5m, 2.5m, 3.5m, 4.5m, 1m, 2m, 3m, 4m, 5m, 2.25m, 3.75m];

        var tasks = attempts.Select(score => Task.Run(() => RateAsync(hotelId, userId, score)));
        await Task.WhenAll(tasks);

        var summary = await SummaryAsync(hotelId);
        Assert.Equal(2, summary.Count);
        Assert.Contains(summary.Sum - 5m, attempts);
    }

    [Fact]
    public async Task DatabaseRejectsScoresOutsideTheRangeAndDuplicatePairs()
    {
        var hotelId = await StoreNewHotelAsync();
        var userId = Guid.NewGuid();
        await RateAsync(hotelId, userId, 3m);

        var belowRange = await database.TryExecuteAsync(
            $"INSERT INTO hotel_ratings (hotel_id, user_id, score) VALUES ('{hotelId}', '{Guid.NewGuid()}', 0.99)");
        var aboveRange = await database.TryExecuteAsync(
            $"INSERT INTO hotel_ratings (hotel_id, user_id, score) VALUES ('{hotelId}', '{Guid.NewGuid()}', 5.01)");
        var duplicate = await database.TryExecuteAsync(
            $"INSERT INTO hotel_ratings (hotel_id, user_id, score) VALUES ('{hotelId}', '{userId}', 4)");
        var orphan = await database.TryExecuteAsync(
            $"INSERT INTO hotel_ratings (hotel_id, user_id, score) VALUES ('{Guid.NewGuid()}', '{Guid.NewGuid()}', 4)");

        Assert.Equal("23514", belowRange?.SqlState);
        Assert.Equal("23514", aboveRange?.SqlState);
        Assert.Equal("23505", duplicate?.SqlState);
        Assert.Equal("23503", orphan?.SqlState);
        Assert.Equal(1, (await SummaryAsync(hotelId)).Count);
    }
}
