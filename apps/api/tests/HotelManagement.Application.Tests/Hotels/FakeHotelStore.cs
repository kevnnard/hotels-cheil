using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Tests.Hotels;

internal sealed class FakeHotelStore : IHotelStore
{
    private readonly Dictionary<Guid, Hotel> hotels = [];

    public List<Hotel> Added { get; } = [];

    public List<Hotel> Updated { get; } = [];

    public List<Guid> Deleted { get; } = [];

    public bool DeleteResult { get; set; }

    public void Seed(Hotel hotel) => hotels[hotel.Id] = hotel;

    public Task AddAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        hotels[hotel.Id] = hotel;
        Added.Add(hotel);
        return Task.CompletedTask;
    }


    public Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken) =>
        Task.FromResult(hotels.GetValueOrDefault(hotelId));

    public Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        Updated.Add(hotel);
        return Task.FromResult(hotels.ContainsKey(hotel.Id));
    }

    public Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        Deleted.Add(hotelId);
        return Task.FromResult(DeleteResult);
    }
}
