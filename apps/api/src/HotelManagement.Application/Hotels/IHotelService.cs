namespace HotelManagement.Application.Hotels;

public interface IHotelService
{
    Task<CreateHotelOutcome> CreateAsync(CreateHotel command, CancellationToken cancellationToken);

    Task<HotelSummary?> FindAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<UpdateHotelOutcome> UpdateAsync(Guid hotelId, UpdateHotel command, CancellationToken cancellationToken);

    Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<RateHotelOutcome> RateAsync(Guid hotelId, Guid userId, decimal score, CancellationToken cancellationToken);
}
