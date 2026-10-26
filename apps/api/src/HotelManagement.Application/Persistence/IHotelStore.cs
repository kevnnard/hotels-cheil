using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Persistence;

public interface IHotelStore
{
    Task AddAsync(Hotel hotel, CancellationToken cancellationToken);

    Task<HotelPage> ListAsync(HotelQuery query, CancellationToken cancellationToken);

    Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken);

    Task<bool> SetActiveAsync(Guid hotelId, bool isActive, DateTime nowUtc, CancellationToken cancellationToken);

    Task<HotelDeletion> DeleteAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<ImageSlotChange> ReplaceImageAsync(Guid hotelId, int position, HotelImage image, DateTime nowUtc, CancellationToken cancellationToken);

    Task<ImageSlotChange> ClearImageAsync(Guid hotelId, int position, DateTime nowUtc, CancellationToken cancellationToken);
}
