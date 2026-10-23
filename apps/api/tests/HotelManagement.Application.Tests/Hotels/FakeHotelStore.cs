using HotelManagement.Application.Hotels;
using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Tests.Hotels;

internal sealed class FakeHotelStore : IHotelStore
{
    private readonly Dictionary<Guid, Hotel> hotels = [];

    public HotelPage PageToReturn { get; set; } = new([], 1, HotelQuery.DefaultPageSize, 0);

    public List<Hotel> Added { get; } = [];

    public List<Hotel> Updated { get; } = [];

    public List<HotelQuery> ListedQueries { get; } = [];

    public List<Guid> Deleted { get; } = [];

    public bool DeleteResult { get; set; }

    public bool UpdateResult { get; set; } = true;

    public void Seed(Hotel hotel) => hotels[hotel.Id] = hotel;

    public Task AddAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        hotels[hotel.Id] = hotel;
        Added.Add(hotel);
        return Task.CompletedTask;
    }

    public Task<HotelPage> ListAsync(HotelQuery query, CancellationToken cancellationToken)
    {
        ListedQueries.Add(query);
        return Task.FromResult(PageToReturn);
    }

    public Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken) =>
        Task.FromResult(hotels.GetValueOrDefault(hotelId));

    public Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        Updated.Add(hotel);
        return Task.FromResult(UpdateResult);
    }

    public Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        Deleted.Add(hotelId);
        return Task.FromResult(DeleteResult);
    }
}
