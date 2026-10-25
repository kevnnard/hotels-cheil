using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
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

    public IReadOnlyList<HotelImage> ReleasedImagesOnDelete { get; set; } = [];

    public bool ReplaceFindsHotel { get; set; } = true;

    public Exception? ReplaceFailure { get; set; }

    public bool ReplaceFailureAfterApplying { get; set; }

    public List<HotelImage> ReplacedImages { get; } = [];

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

    public Task<HotelDeletion> DeleteAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        Deleted.Add(hotelId);
        return Task.FromResult(new HotelDeletion(DeleteResult, DeleteResult ? ReleasedImagesOnDelete : []));
    }

    public Task<ImageSlotChange> ReplaceImageAsync(Guid hotelId, int position, HotelImage image, DateTime nowUtc, CancellationToken cancellationToken)
    {
        if (ReplaceFailure is not null && !ReplaceFailureAfterApplying)
        {
            throw ReplaceFailure;
        }

        if (!ReplaceFindsHotel || !hotels.TryGetValue(hotelId, out var hotel))
        {
            return Task.FromResult(new ImageSlotChange(false, null));
        }

        var changed = Copy(hotel);
        var previous = changed.PlaceImage(position, image, nowUtc);
        hotels[hotelId] = changed;
        ReplacedImages.Add(image);
        if (ReplaceFailure is not null)
        {
            throw ReplaceFailure;
        }

        return Task.FromResult(new ImageSlotChange(true, previous));
    }

    public Task<ImageSlotChange> ClearImageAsync(Guid hotelId, int position, DateTime nowUtc, CancellationToken cancellationToken)
    {
        if (!hotels.TryGetValue(hotelId, out var hotel))
        {
            return Task.FromResult(new ImageSlotChange(false, null));
        }

        var changed = Copy(hotel);
        var previous = changed.RemoveImage(position, nowUtc);
        hotels[hotelId] = changed;
        return Task.FromResult(new ImageSlotChange(true, previous));
    }

    private static Hotel Copy(Hotel hotel) =>
        Hotel.Restore(hotel.Id, hotel.Details, hotel.IsActive, hotel.CreatedAtUtc, hotel.UpdatedAtUtc, hotel.Images);
}
