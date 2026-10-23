using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Persistence;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelPersistenceTests(PostgresDatabaseFixture database)
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, 123, DateTimeKind.Utc);
    private static readonly DateTime LaterAt = CreatedAt.AddHours(3);

    private static HotelDetails FullDetails(string name = "Gran Hotel") => new(
        name,
        "Seafront hotel",
        new HotelAddress("1 Beach Road", "Cartagena", "Bolivar", "Colombia", "130001"),
        new HotelContact("+57 5 555 0100", "frontdesk@example.com", "https://hotel.example.com"));

    private async Task<Hotel> StoreNewHotelAsync(HotelDetails? details = null)
    {
        var hotel = Hotel.Create(details ?? FullDetails(), CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel;
    }

    [Fact]
    public async Task AddedHotel_IsRestoredWithEveryStoredValue()
    {
        var hotel = await StoreNewHotelAsync();

        var restored = await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None);

        Assert.NotNull(restored);
        Assert.Equal(hotel.Id, restored.Id);
        Assert.Equal(hotel.Details, restored.Details);
        Assert.True(restored.IsActive);
        Assert.Equal(CreatedAt, restored.CreatedAtUtc);
        Assert.Equal(CreatedAt, restored.UpdatedAtUtc);
        Assert.Equal(DateTimeKind.Utc, restored.CreatedAtUtc.Kind);
    }

    [Fact]
    public async Task HotelWithOnlyAName_RoundTripsWithoutOptionalData()
    {
        var hotel = await StoreNewHotelAsync(new HotelDetails("Minimal"));

        var restored = await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None);

        Assert.NotNull(restored);
        Assert.Equal(new HotelDetails("Minimal"), restored.Details);
    }

    [Fact]
    public async Task HotelNamesAreNotUnique()
    {
        var first = await StoreNewHotelAsync(new HotelDetails("Twin Name"));
        var second = await StoreNewHotelAsync(new HotelDetails("Twin Name"));

        Assert.NotEqual(first.Id, second.Id);
        Assert.NotNull(await database.CreateStore().FindAsync(second.Id, CancellationToken.None));
    }

    [Fact]
    public async Task UnknownHotel_IsNotFound()
    {
        Assert.Null(await database.CreateStore().FindAsync(Guid.NewGuid(), CancellationToken.None));
    }

    [Fact]
    public async Task UpdatedHotel_PersistsChangesAndKeepsCreationTime()
    {
        var hotel = await StoreNewHotelAsync();
        var untouched = await StoreNewHotelAsync(new HotelDetails("Untouched"));
        hotel.Update(new HotelDetails("Renamed Hotel"), LaterAt);
        hotel.SetActive(false, LaterAt);

        var updated = await database.CreateStore().UpdateAsync(hotel, CancellationToken.None);

        var store = database.CreateStore();
        var restored = await store.FindAsync(hotel.Id, CancellationToken.None);
        Assert.True(updated);
        Assert.NotNull(restored);
        Assert.Equal(new HotelDetails("Renamed Hotel"), restored.Details);
        Assert.False(restored.IsActive);
        Assert.Equal(CreatedAt, restored.CreatedAtUtc);
        Assert.Equal(LaterAt, restored.UpdatedAtUtc);
        Assert.Equal("Untouched", (await store.FindAsync(untouched.Id, CancellationToken.None))!.Details.Name);
    }

    [Fact]
    public async Task UpdatingUnknownHotel_ReportsMissingAndStoresNothing()
    {
        var ghost = Hotel.Create(FullDetails(), CreatedAt);

        var updated = await database.CreateStore().UpdateAsync(ghost, CancellationToken.None);

        Assert.False(updated);
        Assert.Null(await database.CreateStore().FindAsync(ghost.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DeletedHotel_IsRemovedTogetherWithItsRatingsAndOthersSurvive()
    {
        var doomed = await StoreNewHotelAsync();
        var survivor = await StoreNewHotelAsync(new HotelDetails("Survivor"));
        await database.CreateRatingStore().RateAsync(doomed.Id, Guid.NewGuid(), 4m, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(survivor.Id, Guid.NewGuid(), 2m, CancellationToken.None);

        var deleted = await database.CreateStore().DeleteAsync(doomed.Id, CancellationToken.None);

        Assert.True(deleted);
        Assert.Null(await database.CreateStore().FindAsync(doomed.Id, CancellationToken.None));
        Assert.Null(await database.CreateRatingStore().GetSummaryAsync(doomed.Id, CancellationToken.None));
        Assert.Equal(1, (await database.CreateRatingStore().GetSummaryAsync(survivor.Id, CancellationToken.None))!.Count);
    }

    [Fact]
    public async Task DeletingUnknownHotel_ReportsMissing()
    {
        Assert.False(await database.CreateStore().DeleteAsync(Guid.NewGuid(), CancellationToken.None));
    }
}
