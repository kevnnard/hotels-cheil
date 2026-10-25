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
        if (query.ActiveOnly)
        {
            hotels = hotels.Where(hotel => hotel.IsActive);
        }

        if (!string.IsNullOrWhiteSpace(query.Name))
        {
            var pattern = $"%{EscapeLikePattern(query.Name.Trim())}%";
            hotels = hotels.Where(hotel => EF.Functions.ILike(hotel.Name, pattern, "\\"));
        }

        if (query.MaximumPrice is { } maximumPrice)
        {
            hotels = hotels.Where(hotel => hotel.PricePerNight != null
                && (hotel.DiscountPercent == null
                    ? hotel.PricePerNight.Value
                    : Math.Round(hotel.PricePerNight.Value * (100 - hotel.DiscountPercent.Value) / 100m, 2)) <= maximumPrice);
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
            .Select(row => new
            {
                row.Hotel,
                row.RatingCount,
                row.RatingSum,
                Images = row.Hotel.Images.OrderBy(image => image.Position).ToList()
            })
            .ToListAsync(cancellationToken);

        var items = rows
            .Select(row =>
            {
                var domain = row.Hotel.ToDomain(row.Images);
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
                    domain.Images,
                    domain.Details.Pricing);
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
            .Include(hotel => hotel.Images)
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
        if (await LockAsync(hotelId, cancellationToken) is null)
        {
            return new HotelDeletion(false, []);
        }

        var released = await database.HotelImages
            .AsNoTracking()
            .Where(image => image.HotelId == hotelId)
            .OrderBy(image => image.Position)
            .ToListAsync(cancellationToken);
        await database.Hotels.Where(hotel => hotel.Id == hotelId).ExecuteDeleteAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new HotelDeletion(true, released.Select(image => image.ToImage()).ToList());
    }

    public async Task<ImageSlotChange> ReplaceImageAsync(Guid hotelId, int position, HotelImage image, DateTime nowUtc, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        if (await LockAsync(hotelId, cancellationToken) is null)
        {
            return new ImageSlotChange(false, null);
        }

        var previous = await ImageAtAsync(hotelId, position, cancellationToken);
        await database.Database.ExecuteSqlAsync(
            $"""
            INSERT INTO hotel_images (hotel_id, position, storage_key, content_type, width, height, size_bytes)
            VALUES ({hotelId}, {position}, {image.StorageKey}, {image.ContentType}, {image.Width}, {image.Height}, {image.SizeBytes})
            ON CONFLICT (hotel_id, position) DO UPDATE SET
                storage_key = EXCLUDED.storage_key,
                content_type = EXCLUDED.content_type,
                width = EXCLUDED.width,
                height = EXCLUDED.height,
                size_bytes = EXCLUDED.size_bytes
            """,
            cancellationToken);
        await TouchAsync(hotelId, nowUtc, cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return new ImageSlotChange(true, previous);
    }

    public async Task<ImageSlotChange> ClearImageAsync(Guid hotelId, int position, DateTime nowUtc, CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        if (await LockAsync(hotelId, cancellationToken) is null)
        {
            return new ImageSlotChange(false, null);
        }

        var previous = await ImageAtAsync(hotelId, position, cancellationToken);
        if (previous is not null)
        {
            await database.HotelImages
                .Where(image => image.HotelId == hotelId && image.Position == position)
                .ExecuteDeleteAsync(cancellationToken);
            await TouchAsync(hotelId, nowUtc, cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
        return new ImageSlotChange(true, previous);
    }

    private async Task<HotelImage?> ImageAtAsync(Guid hotelId, int position, CancellationToken cancellationToken)
    {
        var record = await database.HotelImages
            .AsNoTracking()
            .SingleOrDefaultAsync(image => image.HotelId == hotelId && image.Position == position, cancellationToken);
        return record?.ToImage();
    }

    private Task TouchAsync(Guid hotelId, DateTime nowUtc, CancellationToken cancellationToken) =>
        database.Hotels
            .Where(hotel => hotel.Id == hotelId)
            .ExecuteUpdateAsync(set => set.SetProperty(hotel => hotel.UpdatedAtUtc, nowUtc), cancellationToken);

    private async Task<HotelRecord?> LockAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var rows = await database.Hotels
            .FromSql($"SELECT * FROM hotels WHERE id = {hotelId} FOR UPDATE")
            .AsNoTracking()
            .ToListAsync(cancellationToken);
        return rows.SingleOrDefault();
    }
}
