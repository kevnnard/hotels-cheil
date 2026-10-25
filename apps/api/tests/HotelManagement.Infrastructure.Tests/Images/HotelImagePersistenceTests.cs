using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Tests.Persistence;
using HotelManagement.TestSupport.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace HotelManagement.Infrastructure.Tests.Images;

[Collection(PostgresCollection.Name)]
public class HotelImagePersistenceTests(PostgresDatabaseFixture database)
{
    private const string PreviousMigration = "20261023180105_AddIdentitySupport";

    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, 123, DateTimeKind.Utc);
    private static readonly DateTime FirstChange = CreatedAt.AddHours(1);
    private static readonly DateTime SecondChange = CreatedAt.AddHours(2);

    private readonly string run = Guid.NewGuid().ToString("N")[..24];

    private HotelImage Image(string label, int sizeBytes = 1000) =>
        new($"{label}{run}".PadRight(32, '0')[..32] + ".png", HotelImage.Png, 640, 480, sizeBytes);

    private static HotelDetails FullDetails(string name) => new(
        name,
        "Seafront hotel",
        new HotelAddress("1 Beach Road", "Cartagena", "Bolivar", "Colombia", "130001"),
        new HotelContact("+57 5 555 0100", "frontdesk@example.com", "https://hotel.example.com"));

    private async Task<Hotel> StoreHotelAsync(string name = "Gran Hotel")
    {
        var hotel = Hotel.Create(FullDetails($"{name} {Guid.NewGuid():N}"), CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel;
    }

    private async Task<Hotel> ReloadAsync(Guid hotelId) =>
        (await database.CreateStore().FindAsync(hotelId, CancellationToken.None))!;

    private async Task<List<string?>> ImageColumnsAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT image_storage_key, image_content_type, image_width::text, image_height::text, image_size_bytes::text FROM hotels WHERE id = @id",
            connection);
        command.Parameters.AddWithValue("id", hotelId);
        await using var reader = await command.ExecuteReaderAsync();
        Assert.True(await reader.ReadAsync());
        return Enumerable.Range(0, reader.FieldCount).Select(index => reader.IsDBNull(index) ? null : reader.GetString(index)).ToList();
    }

    [Fact]
    public async Task ReplacingTheImage_AttachesItAndReportsNoPreviousOne()
    {
        var hotel = await StoreHotelAsync();
        var image = Image("a1");

        var change = await database.CreateStore().ReplaceImageAsync(hotel.Id, image, FirstChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Null(change.Previous);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Equal(image, restored.Image);
        Assert.Equal(FirstChange, restored.UpdatedAtUtc);
        Assert.Equal(hotel.Details, restored.Details);
        Assert.Equal(CreatedAt, restored.CreatedAtUtc);
        Assert.True(restored.IsActive);
    }

    [Fact]
    public async Task ReplacingAgain_ReportsThePreviousImageAndKeepsOnlyTheNewOne()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);

        var change = await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("b2", 2000), SecondChange, CancellationToken.None);

        Assert.Equal(Image("a1"), change.Previous);
        Assert.Equal(Image("b2", 2000), (await ReloadAsync(hotel.Id)).Image);
    }

    [Fact]
    public async Task ReplacingTheImageOfAnUnknownHotel_ReportsItAndStoresNothing()
    {
        var change = await database.CreateStore().ReplaceImageAsync(Guid.NewGuid(), Image("c3"), FirstChange, CancellationToken.None);

        Assert.False(change.HotelFound);
        Assert.Null(change.Previous);
    }

    [Fact]
    public async Task ClearingTheImage_ReportsItAndEmptiesEveryImageColumn()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);

        var change = await database.CreateStore().ClearImageAsync(hotel.Id, SecondChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Equal(Image("a1"), change.Previous);
        Assert.All(await ImageColumnsAsync(hotel.Id), Assert.Null);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Null(restored.Image);
        Assert.Equal(SecondChange, restored.UpdatedAtUtc);
    }

    [Fact]
    public async Task ClearingAHotelWithoutAnImage_ChangesNothing()
    {
        var hotel = await StoreHotelAsync();

        var change = await database.CreateStore().ClearImageAsync(hotel.Id, FirstChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Null(change.Previous);
        Assert.Equal(CreatedAt, (await ReloadAsync(hotel.Id)).UpdatedAtUtc);
    }

    [Fact]
    public async Task ClearingTheImageOfAnUnknownHotel_ReportsIt()
    {
        var change = await database.CreateStore().ClearImageAsync(Guid.NewGuid(), FirstChange, CancellationToken.None);

        Assert.False(change.HotelFound);
        Assert.Null(change.Previous);
    }

    [Fact]
    public async Task ListedSummaries_ProjectTheImageOfEachHotelThroughEveryFilter()
    {
        var marker = Guid.NewGuid().ToString("N");
        var withImage = Hotel.Create(new HotelDetails($"Pictured {marker}"), CreatedAt);
        var withoutImage = Hotel.Create(new HotelDetails($"Plain {marker}"), CreatedAt.AddSeconds(1));
        await database.CreateStore().AddAsync(withImage, CancellationToken.None);
        await database.CreateStore().AddAsync(withoutImage, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(withImage.Id, Image("d4"), FirstChange, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(withImage.Id, Guid.NewGuid(), 4m, CancellationToken.None);

        var everything = await database.CreateStore().ListAsync(new HotelQuery { Name = marker }, CancellationToken.None);
        var rated = await database.CreateStore().ListAsync(new HotelQuery { Name = marker, MinimumRating = 3m }, CancellationToken.None);
        var firstPage = await database.CreateStore().ListAsync(new HotelQuery { Name = marker, PageSize = 1 }, CancellationToken.None);

        Assert.Equal([Image("d4"), null], everything.Items.Select(item => item.Image));
        Assert.Equal([withImage.Id, withoutImage.Id], everything.Items.Select(item => item.Id));
        Assert.Equal(Image("d4"), Assert.Single(rated.Items).Image);
        Assert.Equal(2, firstPage.TotalItems);
        Assert.Equal(Image("d4"), Assert.Single(firstPage.Items).Image);
        Assert.Equal(4m, Assert.Single(rated.Items).Rating.Average);
    }

    [Fact]
    public async Task ASnapshotTakenBeforeAnImageWasAttached_CannotEraseItWhenMetadataIsUpdated()
    {
        var hotel = await StoreHotelAsync();
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);
        staleSnapshot.Update(FullDetails("Renamed Hotel"), SecondChange);

        var updated = await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        Assert.True(updated);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Equal("Renamed Hotel", restored.Details.Name);
        Assert.Equal(Image("a1"), restored.Image);
    }

    [Fact]
    public async Task ASnapshotHoldingAnOldImage_CannotOverwriteAConcurrentReplacementWhenMetadataIsUpdated()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("b2", 2000), SecondChange, CancellationToken.None);
        staleSnapshot.Update(FullDetails("Renamed Hotel"), SecondChange.AddMinutes(1));

        await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        Assert.Equal(Image("b2", 2000), (await ReloadAsync(hotel.Id)).Image);
    }

    [Fact]
    public async Task AStaleSnapshotCannotResurrectAnImageThatWasRemoved()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ClearImageAsync(hotel.Id, SecondChange, CancellationToken.None);
        staleSnapshot.SetActive(false, SecondChange.AddMinutes(1));

        await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        var restored = await ReloadAsync(hotel.Id);
        Assert.Null(restored.Image);
        Assert.False(restored.IsActive);
        Assert.All(await ImageColumnsAsync(hotel.Id), Assert.Null);
    }

    [Fact]
    public async Task Ratings_LeaveTheImageUntouched()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);

        await database.CreateRatingStore().RateAsync(hotel.Id, Guid.NewGuid(), 5m, CancellationToken.None);

        Assert.Equal(Image("a1"), (await ReloadAsync(hotel.Id)).Image);
    }

    [Fact]
    public async Task DeletingAHotel_ReleasesItsImageForCleanup()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Image("a1"), FirstChange, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(hotel.Id, Guid.NewGuid(), 5m, CancellationToken.None);

        var deletion = await database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None);

        Assert.True(deletion.Deleted);
        Assert.Equal(Image("a1"), deletion.ReleasedImage);
        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
        Assert.Null(await database.CreateRatingStore().GetSummaryAsync(hotel.Id, CancellationToken.None));
    }

    [Fact]
    public async Task DeletingAHotelWithoutAnImage_ReleasesNothing()
    {
        var hotel = await StoreHotelAsync();

        var deletion = await database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None);

        Assert.True(deletion.Deleted);
        Assert.Null(deletion.ReleasedImage);
    }

    [Fact]
    public async Task ConcurrentReplacements_ReleaseEveryDisplacedImageExactlyOnceAndKeepOneSurvivor()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 12).Select(index => Image($"e{index:x2}")).ToArray();

        var changes = await Task.WhenAll(images.Select(image =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, image, FirstChange, CancellationToken.None))));

        var survivor = (await ReloadAsync(hotel.Id)).Image;
        Assert.NotNull(survivor);
        Assert.All(changes, change => Assert.True(change.HotelFound));
        var released = changes.Select(change => change.Previous).OfType<HotelImage>().Select(image => image.StorageKey).ToList();
        Assert.Equal(images.Length - 1, released.Count);
        Assert.Equal(released.Count, released.Distinct().Count());
        Assert.DoesNotContain(survivor.StorageKey, released);
        Assert.Equal(images.Select(image => image.StorageKey).Order(), released.Append(survivor.StorageKey).Order());
    }

    [Fact]
    public async Task ConcurrentReplacementsAndRemovals_NeverLoseOrDuplicateAReference()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 8).Select(index => Image($"f{index:x2}")).ToArray();

        var replacements = Task.WhenAll(images.Select(image =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, image, FirstChange, CancellationToken.None))));
        var removals = Task.WhenAll(Enumerable.Range(0, 4).Select(_ =>
            Task.Run(() => database.CreateStore().ClearImageAsync(hotel.Id, SecondChange, CancellationToken.None))));
        var changes = (await replacements).Concat(await removals);

        var released = changes.Select(change => change.Previous).OfType<HotelImage>().Select(image => image.StorageKey).ToList();
        var survivor = (await ReloadAsync(hotel.Id)).Image;
        var accounted = survivor is null ? released : released.Append(survivor.StorageKey).ToList();
        Assert.Equal(images.Select(image => image.StorageKey).Order(), accounted.Order());
    }

    [Fact]
    public async Task ConcurrentReplacementsAndHotelDeletion_AccountForEveryStoredImage()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 8).Select(index => Image($"g{index:x2}")).ToArray();

        var replacements = Task.WhenAll(images.Select(image =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, image, FirstChange, CancellationToken.None))));
        var deletion = Task.Run(() => database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None));
        var changes = await replacements;
        var deleted = await deletion;

        Assert.True(deleted.Deleted);
        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
        var released = changes.Select(change => change.Previous)
            .Append(deleted.ReleasedImage)
            .OfType<HotelImage>()
            .Select(image => image.StorageKey)
            .ToList();
        Assert.Equal(changes.Count(change => change.HotelFound), released.Count);
        Assert.Equal(released.Count, released.Distinct().Count());
    }

    [Fact]
    public async Task TheDatabase_RejectsIncompleteOrOversizedImageMetadata()
    {
        var hotel = await StoreHotelAsync();

        var incomplete = await database.TryExecuteAsync(
            $"UPDATE hotels SET image_storage_key = '{new string('a', 32)}.png' WHERE id = '{hotel.Id}'");
        var oversized = await database.TryExecuteAsync(
            $"UPDATE hotels SET image_storage_key = '{new string('b', 32)}.png', image_content_type = 'image/png', image_width = 1, image_height = 1, image_size_bytes = 400001 WHERE id = '{hotel.Id}'");

        Assert.Equal("23514", incomplete?.SqlState);
        Assert.Equal("23514", oversized?.SqlState);
        Assert.All(await ImageColumnsAsync(hotel.Id), Assert.Null);
    }

    [Fact]
    public async Task TheDatabase_RejectsTwoHotelsSharingOneStoredFile()
    {
        var first = await StoreHotelAsync();
        var second = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(first.Id, Image("h8"), FirstChange, CancellationToken.None);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            database.CreateStore().ReplaceImageAsync(second.Id, Image("h8"), FirstChange, CancellationToken.None));

        Assert.Null((await ReloadAsync(second.Id)).Image);
        Assert.Equal(Image("h8"), (await ReloadAsync(first.Id)).Image);
    }

    [Fact]
    public async Task UpgradingFromTheSchemaWithoutImages_KeepsExistingHotelsValidAndImageless()
    {
        await using var context = database.CreateContext();
        var migrator = context.GetService<IMigrator>();
        var hotelId = Guid.NewGuid();
        try
        {
            await migrator.MigrateAsync(PreviousMigration);
            var seeded = await database.TryExecuteAsync(
                $"INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc) VALUES ('{hotelId}', 'Legacy Hotel', true, now(), now())");
            Assert.Null(seeded);
        }
        finally
        {
            await migrator.MigrateAsync();
        }

        var restored = await ReloadAsync(hotelId);
        Assert.Equal("Legacy Hotel", restored.Details.Name);
        Assert.Null(restored.Image);
        Assert.All(await ImageColumnsAsync(hotelId), Assert.Null);
        await database.CreateStore().DeleteAsync(hotelId, CancellationToken.None);
    }
}
