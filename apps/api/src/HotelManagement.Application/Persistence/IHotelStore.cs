using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Persistence;

public interface IHotelStore
{
    Task AddAsync(Hotel hotel, CancellationToken cancellationToken);

    Task<HotelPage> ListAsync(HotelQuery query, CancellationToken cancellationToken);

    Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken);
}
