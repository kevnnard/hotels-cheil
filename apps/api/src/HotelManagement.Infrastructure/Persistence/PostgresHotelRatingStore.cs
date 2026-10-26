using HotelManagement.Application.Persistence;
using HotelManagement.Domain;
using HotelManagement.Domain.Ratings;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class PostgresHotelRatingStore(HotelDbContext database) : IHotelRatingsStore
{
    public async Task<RatingSummary?> GetSummaryAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var exists = await database.Hotels.AnyAsync(hotel => hotel.Id == hotelId, cancellationToken);
        return exists ? await SummarizeAsync(hotelId, cancellationToken) : null;
    }

    public Task<decimal?> FindScoreAsync(Guid hotelId, Guid userId, CancellationToken cancellationToken) =>
        database.HotelRatings
            .AsNoTracking()
            .Where(rating => rating.HotelId == hotelId && rating.UserId == userId)
            .Select(rating => (decimal?)rating.Score)
            .SingleOrDefaultAsync(cancellationToken);

    public async Task<RatingSummary?> RateAsync(
        Guid hotelId,
        Guid userId,
        decimal score,
        CancellationToken cancellationToken)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainValidationException("A rating requires a user identifier.");
        }

        var rating = RatingScore.Create(score);
        try
        {
            await database.Database.ExecuteSqlAsync(
                $"""
                INSERT INTO hotel_ratings (hotel_id, user_id, score)
                VALUES ({hotelId}, {userId}, {rating.Value})
                ON CONFLICT (hotel_id, user_id) DO UPDATE SET score = EXCLUDED.score
                """,
                cancellationToken);
        }
        catch (PostgresException exception) when (exception.SqlState == PostgresErrorCodes.ForeignKeyViolation)
        {
            return null;
        }

        return await SummarizeAsync(hotelId, cancellationToken);
    }

    private async Task<RatingSummary> SummarizeAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var totals = await database.HotelRatings
            .Where(rating => rating.HotelId == hotelId)
            .GroupBy(rating => rating.HotelId)
            .Select(group => new { Sum = group.Sum(rating => rating.Score), Count = group.Count() })
            .SingleOrDefaultAsync(cancellationToken);
        return totals is null ? RatingSummary.Empty : RatingSummary.From(totals.Sum, totals.Count);
    }
}
