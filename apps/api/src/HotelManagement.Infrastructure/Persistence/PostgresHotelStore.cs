using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class PostgresHotelStore(HotelDbContext database) : IHotelStore
{
    public async Task AddAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        database.Hotels.Add(HotelRecord.From(hotel));
        await database.SaveChangesAsync(cancellationToken);
    }

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

    public async Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken) =>
        await database.Hotels.Where(hotel => hotel.Id == hotelId).ExecuteDeleteAsync(cancellationToken) > 0;
}
