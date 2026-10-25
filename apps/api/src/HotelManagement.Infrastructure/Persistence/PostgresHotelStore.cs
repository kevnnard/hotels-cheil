using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Ratings;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class PostgresHotelStore(HotelDbContext database) : IHotelStore
{
    public async Task AddAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        database.Hotels.Add(HotelRecord.From(hotel));
        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task<HotelPage> ListAsync(HotelQuery query, CancellationToken cancellationToken)
    {
        var hotels = database.Hotels.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(query.Name))
        {
            var pattern = $"%{EscapeLikePattern(query.Name.Trim())}%";
            hotels = hotels.Where(hotel => EF.Functions.ILike(hotel.Name, pattern, "\\"));
        }

        var aggregated = hotels.Select(hotel => new
        {
            Hotel = hotel,
            RatingCount = database.HotelRatings.Count(rating => rating.HotelId == hotel.Id),
            RatingSum = database.HotelRatings
                .Where(rating => rating.HotelId == hotel.Id)
                .Sum(rating => (decimal?)rating.Score) ?? 0m
        });

        if (query.MinimumRating is { } minimumRating)
        {
            aggregated = aggregated.Where(row => row.RatingCount > 0 && row.RatingSum >= minimumRating * row.RatingCount);
        }

        var totalItems = await aggregated.CountAsync(cancellationToken);
        var requestedOffset = ((long)query.Page - 1) * query.PageSize;
        var offset = (int)Math.Min(requestedOffset, int.MaxValue);
        var rows = await aggregated
            .OrderBy(row => row.Hotel.CreatedAtUtc)
            .ThenBy(row => row.Hotel.Id)
            .Skip(offset)
            .Take(query.PageSize)
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(row =>
            {
                var domain = row.Hotel.ToDomain();
                return new HotelSummary(
                    domain.Id,
                    domain.Details.Name,
                    domain.Details.Description,
                    domain.Details.Address,
                    domain.Details.Contact,
                    domain.IsActive,
                    domain.CreatedAtUtc,
                    domain.UpdatedAtUtc,
                    RatingSummary.From(row.RatingSum, row.RatingCount),
                    domain.Image);
            })
            .ToList();

        return new HotelPage(items, query.Page, query.PageSize, totalItems);
    }

    private static string EscapeLikePattern(string value) =>
        value.Replace("\\", "\\\\").Replace("%", "\\%").Replace("_", "\\_");

    public async Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var record = await database.Hotels
            .AsNoTracking()
            .SingleOrDefaultAsync(hotel => hotel.Id == hotelId, cancellationToken);
        return record?.ToDomain();
    }

    public async Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        var record = await database.Hotels.SingleOrDefaultAsync(stored => stored.Id == hotel.Id, cancellationToken);
        if (record is null)
        {
            return false;
        }

        record.CopyFrom(hotel);
        try
        {
            await database.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException)
        {
            return false;
        }
    }

    public async Task<HotelDeletion> DeleteAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var locked = await LockAsync(hotelId, cancellationToken);
        if (locked is null)
        {
            return new HotelDeletion(false, null);
        }

        await database.Hotels.Where(hotel => hotel.Id == hotelId).ExecuteDeleteAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new HotelDeletion(true, locked.ToImage());
    }

    public async Task<ImageSlotChange> ReplaceImageAsync(Guid hotelId, HotelImage image, DateTime nowUtc, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var locked = await LockAsync(hotelId, cancellationToken);
        if (locked is null)
        {
            return new ImageSlotChange(false, null);
        }

        await database.Hotels
            .Where(hotel => hotel.Id == hotelId)
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(hotel => hotel.ImageStorageKey, image.StorageKey)
                    .SetProperty(hotel => hotel.ImageContentType, image.ContentType)
                    .SetProperty(hotel => hotel.ImageWidth, image.Width)
                    .SetProperty(hotel => hotel.ImageHeight, image.Height)
                    .SetProperty(hotel => hotel.ImageSizeBytes, image.SizeBytes)
                    .SetProperty(hotel => hotel.UpdatedAtUtc, nowUtc),
                cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ImageSlotChange(true, locked.ToImage());
    }

    public async Task<ImageSlotChange> ClearImageAsync(Guid hotelId, DateTime nowUtc, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var locked = await LockAsync(hotelId, cancellationToken);
        if (locked is null)
        {
            return new ImageSlotChange(false, null);
        }

        if (locked.ToImage() is not null)
        {
            await database.Hotels
                .Where(hotel => hotel.Id == hotelId)
                .ExecuteUpdateAsync(
                    set => set
                        .SetProperty(hotel => hotel.ImageStorageKey, (string?)null)
                        .SetProperty(hotel => hotel.ImageContentType, (string?)null)
                        .SetProperty(hotel => hotel.ImageWidth, (int?)null)
                        .SetProperty(hotel => hotel.ImageHeight, (int?)null)
                        .SetProperty(hotel => hotel.ImageSizeBytes, (int?)null)
                        .SetProperty(hotel => hotel.UpdatedAtUtc, nowUtc),
                    cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new ImageSlotChange(true, locked.ToImage());
    }

    private async Task<HotelRecord?> LockAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var rows = await database.Hotels
            .FromSql($"SELECT * FROM hotels WHERE id = {hotelId} FOR UPDATE")
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.SingleOrDefault();
    }
}
