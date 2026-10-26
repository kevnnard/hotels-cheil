using System.Data.Common;
using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Persistence;
using HotelManagement.Infrastructure.Tests.Persistence;
using HotelManagement.TestSupport.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Npgsql;

namespace HotelManagement.Infrastructure.Tests.Images;

[Collection(PostgresCollection.Name)]
public class HotelImagePersistenceTests(PostgresDatabaseFixture database)
{
    private const int Primary = HotelImageSlot.Primary;

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

    private async Task<List<(int Position, string StorageKey)>> ImageRowsAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT position, storage_key FROM hotel_images WHERE hotel_id = @id ORDER BY position",
            connection);
        command.Parameters.AddWithValue("id", hotelId);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<(int, string)>();
        while (await reader.ReadAsync())
        {
            rows.Add((reader.GetInt32(0), reader.GetString(1)));
        }

        return rows;
    }

    [Fact]
    public async Task ReplacingAPosition_AttachesItAndReportsNoPreviousOne()
    {
        var hotel = await StoreHotelAsync();
        var image = Image("a1");

        var change = await database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, image, FirstChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Null(change.Previous);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Equal(image, restored.Image);
        Assert.Equal([new HotelImageSlot(Primary, image)], restored.Images);
        Assert.Equal(FirstChange, restored.UpdatedAtUtc);
        Assert.Equal(hotel.Details, restored.Details);
        Assert.Equal(CreatedAt, restored.CreatedAtUtc);
        Assert.True(restored.IsActive);
    }

    [Fact]
    public async Task ReplacingAgain_ReportsThePreviousImageOfThatPositionAndKeepsOnlyTheNewOne()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 1, Image("a1"), FirstChange, CancellationToken.None);

        var change = await database.CreateStore().ReplaceImageAsync(hotel.Id, 1, Image("b2", 2000), SecondChange, CancellationToken.None);

        Assert.Equal(Image("a1"), change.Previous);
        Assert.Equal([(1, Image("b2").StorageKey)], await ImageRowsAsync(hotel.Id));
        Assert.Equal(Image("b2", 2000), (await ReloadAsync(hotel.Id)).ImageAt(1));
    }

    [Fact]
    public async Task Positions_AreIndependentOfEachOther()
    {
        var hotel = await StoreHotelAsync();
        for (var position = 0; position < HotelImageSlot.Count; position++)
        {
            var filled = await database.CreateStore().ReplaceImageAsync(hotel.Id, position, Image($"p{position}"), FirstChange, CancellationToken.None);
            Assert.Null(filled.Previous);
        }

        var replaced = await database.CreateStore().ReplaceImageAsync(hotel.Id, 1, Image("r1"), SecondChange, CancellationToken.None);
        var cleared = await database.CreateStore().ClearImageAsync(hotel.Id, 0, SecondChange, CancellationToken.None);

        Assert.Equal(Image("p1"), replaced.Previous);
        Assert.Equal(Image("p0"), cleared.Previous);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Null(restored.Image);
        Assert.Equal([new HotelImageSlot(1, Image("r1")), new HotelImageSlot(2, Image("p2"))], restored.Images);
    }

    [Fact]
    public async Task ReplacingTheImageOfAnUnknownHotel_ReportsItAndStoresNothing()
    {
        var hotelId = Guid.NewGuid();

        var change = await database.CreateStore().ReplaceImageAsync(hotelId, 2, Image("c3"), FirstChange, CancellationToken.None);

        Assert.False(change.HotelFound);
        Assert.Null(change.Previous);
        Assert.Empty(await ImageRowsAsync(hotelId));
    }

    [Fact]
    public async Task ClearingAPosition_ReportsItAndDeletesOnlyItsRow()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 0, Image("a1"), FirstChange, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 2, Image("c3"), FirstChange, CancellationToken.None);

        var change = await database.CreateStore().ClearImageAsync(hotel.Id, 2, SecondChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Equal(Image("c3"), change.Previous);
        Assert.Equal([(0, Image("a1").StorageKey)], await ImageRowsAsync(hotel.Id));
        Assert.Equal(SecondChange, (await ReloadAsync(hotel.Id)).UpdatedAtUtc);
    }

    [Fact]
    public async Task ClearingAnEmptyPosition_ChangesNothing()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 0, Image("a1"), FirstChange, CancellationToken.None);

        var change = await database.CreateStore().ClearImageAsync(hotel.Id, 1, SecondChange, CancellationToken.None);

        Assert.True(change.HotelFound);
        Assert.Null(change.Previous);
        Assert.Equal(FirstChange, (await ReloadAsync(hotel.Id)).UpdatedAtUtc);
        Assert.Single(await ImageRowsAsync(hotel.Id));
    }

    [Fact]
    public async Task ClearingTheImageOfAnUnknownHotel_ReportsIt()
    {
        var change = await database.CreateStore().ClearImageAsync(Guid.NewGuid(), Primary, FirstChange, CancellationToken.None);

        Assert.False(change.HotelFound);
        Assert.Null(change.Previous);
    }

    [Fact]
    public async Task ListedSummaries_ProjectTheImagesOfEachHotelThroughEveryFilter()
    {
        var marker = Guid.NewGuid().ToString("N");
        var withImages = Hotel.Create(new HotelDetails($"Pictured {marker}"), CreatedAt);
        var withoutImage = Hotel.Create(new HotelDetails($"Plain {marker}"), CreatedAt.AddSeconds(1));
        await database.CreateStore().AddAsync(withImages, CancellationToken.None);
        await database.CreateStore().AddAsync(withoutImage, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(withImages.Id, 2, Image("d6"), FirstChange, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(withImages.Id, 0, Image("d4"), FirstChange, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(withImages.Id, Guid.NewGuid(), 4m, CancellationToken.None);
        HotelImageSlot[] expected = [new(0, Image("d4")), new(2, Image("d6"))];

        var everything = await database.CreateStore().ListAsync(new HotelQuery { Name = marker }, CancellationToken.None);
        var rated = await database.CreateStore().ListAsync(new HotelQuery { Name = marker, MinimumRating = 3m }, CancellationToken.None);
        var firstPage = await database.CreateStore().ListAsync(new HotelQuery { Name = marker, PageSize = 1 }, CancellationToken.None);

        Assert.Equal([Image("d4"), null], everything.Items.Select(item => item.Image));
        Assert.Equal(expected, everything.Items[0].Images);
        Assert.Empty(everything.Items[1].Images);
        Assert.Equal([withImages.Id, withoutImage.Id], everything.Items.Select(item => item.Id));
        Assert.Equal(expected, Assert.Single(rated.Items).Images);
        Assert.Equal(2, firstPage.TotalItems);
        Assert.Equal(expected, Assert.Single(firstPage.Items).Images);
        Assert.Equal(4m, Assert.Single(rated.Items).Rating.Average);
    }

    [Fact]
    public async Task Listing_LoadsTheImagesOfAWholePageWithoutAQueryPerHotel()
    {
        var marker = Guid.NewGuid().ToString("N");
        for (var index = 0; index < 6; index++)
        {
            var hotel = Hotel.Create(new HotelDetails($"Counted {index} {marker}"), CreatedAt.AddSeconds(index));
            await database.CreateStore().AddAsync(hotel, CancellationToken.None);
            for (var position = 0; position < HotelImageSlot.Count; position++)
            {
                await database.CreateStore().ReplaceImageAsync(hotel.Id, position, Image($"n{index}{position}"), FirstChange, CancellationToken.None);
            }
        }

        var single = await CountCommandsAsync(new HotelQuery { Name = marker, PageSize = 1 });
        var whole = await CountCommandsAsync(new HotelQuery { Name = marker, PageSize = 6 });

        Assert.Equal(single.Commands, whole.Commands);
        Assert.Equal(6, whole.Page.Items.Count);
        Assert.All(whole.Page.Items, item => Assert.Equal([0, 1, 2], item.Images.Select(slot => slot.Position)));
    }

    private async Task<(int Commands, HotelPage Page)> CountCommandsAsync(HotelQuery query)
    {
        var counter = new CommandCounter();
        var options = new DbContextOptionsBuilder<HotelDbContext>().UseNpgsql(database.ConnectionString).AddInterceptors(counter).Options;
        await using var context = new HotelDbContext(options);
        var page = await new PostgresHotelStore(context).ListAsync(query, CancellationToken.None);
        return (counter.Count, page);
    }

    [Fact]
    public async Task ASnapshotTakenBeforeAnImageWasAttached_CannotEraseItWhenMetadataIsUpdated()
    {
        var hotel = await StoreHotelAsync();
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 1, Image("a1"), FirstChange, CancellationToken.None);
        staleSnapshot.Update(FullDetails("Renamed Hotel"), SecondChange);

        var updated = await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        Assert.True(updated);
        var restored = await ReloadAsync(hotel.Id);
        Assert.Equal("Renamed Hotel", restored.Details.Name);
        Assert.Equal(Image("a1"), restored.ImageAt(1));
    }

    [Fact]
    public async Task ASnapshotHoldingAnOldImage_CannotOverwriteAConcurrentReplacementWhenMetadataIsUpdated()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, Image("a1"), FirstChange, CancellationToken.None);
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, Image("b2", 2000), SecondChange, CancellationToken.None);
        staleSnapshot.Update(FullDetails("Renamed Hotel"), SecondChange.AddMinutes(1));

        await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        Assert.Equal(Image("b2", 2000), (await ReloadAsync(hotel.Id)).Image);
    }

    [Fact]
    public async Task AStaleSnapshotCannotResurrectAnImageThatWasRemoved()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, Image("a1"), FirstChange, CancellationToken.None);
        var staleSnapshot = await ReloadAsync(hotel.Id);
        await database.CreateStore().ClearImageAsync(hotel.Id, Primary, SecondChange, CancellationToken.None);
        staleSnapshot.Update(new HotelDetails("Renamed From A Stale Snapshot"), SecondChange.AddMinutes(1));

        await database.CreateStore().UpdateAsync(staleSnapshot, CancellationToken.None);

        var restored = await ReloadAsync(hotel.Id);
        Assert.Empty(restored.Images);
        Assert.Equal("Renamed From A Stale Snapshot", restored.Details.Name);
        Assert.Empty(await ImageRowsAsync(hotel.Id));
    }

    [Fact]
    public async Task Ratings_LeaveTheImagesUntouched()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, Image("a1"), FirstChange, CancellationToken.None);

        await database.CreateRatingStore().RateAsync(hotel.Id, Guid.NewGuid(), 5m, CancellationToken.None);

        Assert.Equal(Image("a1"), (await ReloadAsync(hotel.Id)).Image);
    }

    [Fact]
    public async Task DeletingAHotel_ReleasesTheImageOfEveryPositionForCleanup()
    {
        var hotel = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 2, Image("c3"), FirstChange, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 0, Image("a1"), FirstChange, CancellationToken.None);
        await database.CreateStore().ReplaceImageAsync(hotel.Id, 1, Image("b2"), FirstChange, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(hotel.Id, Guid.NewGuid(), 5m, CancellationToken.None);

        var deletion = await database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None);

        Assert.True(deletion.Deleted);
        Assert.Equal([Image("a1"), Image("b2"), Image("c3")], deletion.ReleasedImages);
        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
        Assert.Null(await database.CreateRatingStore().GetSummaryAsync(hotel.Id, CancellationToken.None));
        Assert.Empty(await ImageRowsAsync(hotel.Id));
    }

    [Fact]
    public async Task DeletingAHotelWithoutImages_ReleasesNothing()
    {
        var hotel = await StoreHotelAsync();

        var deletion = await database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None);

        Assert.True(deletion.Deleted);
        Assert.Empty(deletion.ReleasedImages);
    }

    [Fact]
    public async Task ConcurrentReplacementsOfOnePosition_ReleaseEveryDisplacedImageExactlyOnceAndKeepOneSurvivor()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 12).Select(index => Image($"e{index:x2}")).ToArray();

        var changes = await Task.WhenAll(images.Select(image =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, 1, image, FirstChange, CancellationToken.None))));

        var survivor = (await ReloadAsync(hotel.Id)).ImageAt(1);
        Assert.NotNull(survivor);
        Assert.All(changes, change => Assert.True(change.HotelFound));
        var released = changes.Select(change => change.Previous).OfType<HotelImage>().Select(image => image.StorageKey).ToList();
        Assert.Equal(images.Length - 1, released.Count);
        Assert.Equal(released.Count, released.Distinct().Count());
        Assert.DoesNotContain(survivor.StorageKey, released);
        Assert.Equal(images.Select(image => image.StorageKey).Order(), released.Append(survivor.StorageKey).Order());
        Assert.Single(await ImageRowsAsync(hotel.Id));
    }

    [Fact]
    public async Task ConcurrentReplacementsOfDifferentPositions_FillEachPositionAndDisplaceNothing()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, HotelImageSlot.Count).Select(position => Image($"k{position}")).ToArray();

        var changes = await Task.WhenAll(images.Select((image, position) =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, position, image, FirstChange, CancellationToken.None))));

        Assert.All(changes, change => Assert.True(change.HotelFound));
        Assert.All(changes, change => Assert.Null(change.Previous));
        Assert.Equal(images.Select((image, position) => new HotelImageSlot(position, image)), (await ReloadAsync(hotel.Id)).Images);
    }

    [Fact]
    public async Task ConcurrentReplacementsAndRemovals_NeverLoseOrDuplicateAReference()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 8).Select(index => Image($"f{index:x2}")).ToArray();

        var replacements = Task.WhenAll(images.Select(image =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, Primary, image, FirstChange, CancellationToken.None))));
        var removals = Task.WhenAll(Enumerable.Range(0, 4).Select(_ =>
            Task.Run(() => database.CreateStore().ClearImageAsync(hotel.Id, Primary, SecondChange, CancellationToken.None))));
        var changes = (await replacements).Concat(await removals);

        var released = changes.Select(change => change.Previous).OfType<HotelImage>().Select(image => image.StorageKey).ToList();
        var survivor = (await ReloadAsync(hotel.Id)).Image;
        var accounted = survivor is null ? released : released.Append(survivor.StorageKey).ToList();
        Assert.Equal(images.Select(image => image.StorageKey).Order(), accounted.Order());
    }

    [Fact]
    public async Task ConcurrentReplacementsOfEveryPositionAndHotelDeletion_AccountForEveryStoredImage()
    {
        var hotel = await StoreHotelAsync();
        var images = Enumerable.Range(0, 9).Select(index => Image($"g{index:x2}")).ToArray();

        var replacements = Task.WhenAll(images.Select((image, index) =>
            Task.Run(() => database.CreateStore().ReplaceImageAsync(hotel.Id, index % HotelImageSlot.Count, image, FirstChange, CancellationToken.None))));
        var deletion = Task.Run(() => database.CreateStore().DeleteAsync(hotel.Id, CancellationToken.None));
        var changes = await replacements;
        var deleted = await deletion;

        Assert.True(deleted.Deleted);
        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
        Assert.Empty(await ImageRowsAsync(hotel.Id));
        var released = changes.Select(change => change.Previous)
            .OfType<HotelImage>()
            .Concat(deleted.ReleasedImages)
            .Select(image => image.StorageKey)
            .ToList();
        Assert.Equal(changes.Count(change => change.HotelFound), released.Count);
        Assert.Equal(released.Count, released.Distinct().Count());
    }

    [Fact]
    public async Task TheDatabase_RejectsIncompleteOrOversizedImageMetadataAndPositionsOutsideTheGallery()
    {
        var hotel = await StoreHotelAsync();
        string Insert(int position, string contentType, int width, int sizeBytes) =>
            "INSERT INTO hotel_images (hotel_id, position, storage_key, content_type, width, height, size_bytes) "
            + $"VALUES ('{hotel.Id}', {position}, '{Guid.NewGuid():N}.png', {contentType}, {width}, 1, {sizeBytes})";

        var oversized = await database.TryExecuteAsync(Insert(0, "'image/png'", 1, 400001));
        var empty = await database.TryExecuteAsync(Insert(0, "'image/png'", 1, 0));
        var flat = await database.TryExecuteAsync(Insert(0, "'image/png'", 0, 1));
        var untyped = await database.TryExecuteAsync(Insert(0, "NULL", 1, 1));
        var fourth = await database.TryExecuteAsync(Insert(3, "'image/png'", 1, 1));

        Assert.Equal("23514", oversized?.SqlState);
        Assert.Equal("23514", empty?.SqlState);
        Assert.Equal("23514", flat?.SqlState);
        Assert.Equal("23502", untyped?.SqlState);
        Assert.Equal("23514", fourth?.SqlState);
        Assert.Empty(await ImageRowsAsync(hotel.Id));
    }

    [Fact]
    public async Task TheDatabase_RejectsOneStoredFileReferencedTwice()
    {
        var first = await StoreHotelAsync();
        var second = await StoreHotelAsync();
        await database.CreateStore().ReplaceImageAsync(first.Id, Primary, Image("h8"), FirstChange, CancellationToken.None);

        await Assert.ThrowsAnyAsync<Exception>(() =>
            database.CreateStore().ReplaceImageAsync(second.Id, Primary, Image("h8"), FirstChange, CancellationToken.None));
        await Assert.ThrowsAnyAsync<Exception>(() =>
            database.CreateStore().ReplaceImageAsync(first.Id, 1, Image("h8"), FirstChange, CancellationToken.None));

        Assert.Empty((await ReloadAsync(second.Id)).Images);
        Assert.Equal([new HotelImageSlot(Primary, Image("h8"))], (await ReloadAsync(first.Id)).Images);
    }

    private sealed class CommandCounter : DbCommandInterceptor
    {
        private int count;

        public int Count => count;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<DbDataReader> result,
            CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref count);
            return base.ReaderExecutingAsync(command, eventData, result, cancellationToken);
        }

        public override ValueTask<InterceptionResult<object>> ScalarExecutingAsync(
            DbCommand command,
            CommandEventData eventData,
            InterceptionResult<object> result,
            CancellationToken cancellationToken = default)
        {
            Interlocked.Increment(ref count);
            return base.ScalarExecutingAsync(command, eventData, result, cancellationToken);
        }
    }
}
