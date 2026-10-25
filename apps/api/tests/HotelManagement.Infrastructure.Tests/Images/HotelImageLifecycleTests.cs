using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Images;
using HotelManagement.Infrastructure.Persistence;
using HotelManagement.Infrastructure.Storage;
using HotelManagement.Infrastructure.Tests.Persistence;
using HotelManagement.TestSupport.Images;
using HotelManagement.TestSupport.Persistence;
using Microsoft.Extensions.Logging.Abstractions;

namespace HotelManagement.Infrastructure.Tests.Images;

[Collection(PostgresCollection.Name)]
public sealed class HotelImageLifecycleTests(PostgresDatabaseFixture database) : IDisposable
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private readonly string root = Path.Combine(Path.GetTempPath(), "hotel-lifecycle-tests", Guid.NewGuid().ToString("N"), "images");
    private readonly MagickImageOptimizationService optimizer = new();

    public void Dispose()
    {
        var workspace = Path.GetDirectoryName(root)!;
        if (Directory.Exists(root) && !OperatingSystem.IsWindows())
        {
            File.SetUnixFileMode(root, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
        }

        if (Directory.Exists(workspace))
        {
            Directory.Delete(workspace, recursive: true);
        }
    }

    private LocalFileStorageService Storage => new(new ImageStorageOptions { RootPath = root }, NullLogger<LocalFileStorageService>.Instance);

    private HotelImageService ImageService(IHotelStore? store = null) =>
        new(store ?? database.CreateStore(), optimizer, Storage, TimeProvider.System);

    private HotelService HotelService() =>
        new(database.CreateStore(), database.CreateRatingStore(), Storage, TimeProvider.System);

    private async Task<Hotel> StoreHotelAsync()
    {
        var hotel = Hotel.Create(new HotelDetails($"Lifecycle {Guid.NewGuid():N}"), CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel;
    }

    private async Task<HotelImage?> StoredImageAsync(Guid hotelId) =>
        (await database.CreateStore().FindAsync(hotelId, CancellationToken.None))?.Image;

    private string[] StoredFiles() =>
        Directory.Exists(root) ? Directory.GetFiles(root).Select(path => Path.GetFileName(path)!).Order().ToArray() : [];

    private static byte[] SmallPng(int seed) => TestImages.Png(RgbaImage.Noise(24, 24, seed, sixteenBit: seed % 2 == 0), depth: seed % 2 == 0 ? 16 : 8);

    [Fact]
    public async Task UploadReplaceRemoveAndDelete_KeepTheFilesystemAndTheDatabaseInStep()
    {
        var hotel = await StoreHotelAsync();
        var first = SmallPng(1);
        var second = SmallPng(2);

        var uploaded = await ImageService().ReplaceAsync(hotel.Id, first, CancellationToken.None);
        Assert.Equal([uploaded.Image!.StorageKey], StoredFiles());
        Assert.Equal(uploaded.Image, await StoredImageAsync(hotel.Id));

        var replaced = await ImageService().ReplaceAsync(hotel.Id, second, CancellationToken.None);
        Assert.Equal([replaced.Image!.StorageKey], StoredFiles());
        Assert.NotEqual(uploaded.Image.StorageKey, replaced.Image.StorageKey);

        var opened = await ImageService().OpenAsync(hotel.Id, CancellationToken.None);
        await using (var content = opened.Content!)
        {
            using var copy = new MemoryStream();
            await content.CopyToAsync(copy);
            Assert.Equal(second, copy.ToArray());
        }

        Assert.Equal(RemoveHotelImageStatus.Removed, await ImageService().RemoveAsync(hotel.Id, CancellationToken.None));
        Assert.Empty(StoredFiles());
        Assert.Null(await StoredImageAsync(hotel.Id));

        await ImageService().ReplaceAsync(hotel.Id, first, CancellationToken.None);
        Assert.Single(StoredFiles());
        Assert.True(await HotelService().DeleteAsync(hotel.Id, CancellationToken.None));
        Assert.Empty(StoredFiles());
        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
    }

    [Fact]
    public async Task ARejectedUpload_LeavesTheCurrentImageAndFilesUntouched()
    {
        var hotel = await StoreHotelAsync();
        var current = (await ImageService().ReplaceAsync(hotel.Id, SmallPng(3), CancellationToken.None)).Image!;
        var filesBefore = StoredFiles();
        var noise = TestImages.Png(RgbaImage.Noise(500, 500, 11));

        var outcome = await ImageService().ReplaceAsync(hotel.Id, noise, CancellationToken.None);

        Assert.Equal(ImageRejection.ExceedsByteBudget, outcome.Rejection);
        Assert.Equal(current, await StoredImageAsync(hotel.Id));
        Assert.Equal(filesBefore, StoredFiles());
    }

    [Fact]
    public async Task WhenTheDatabaseSwapFails_TheStagedFileIsRemovedAndTheCurrentImageSurvives()
    {
        var hotel = await StoreHotelAsync();
        var current = (await ImageService().ReplaceAsync(hotel.Id, SmallPng(4), CancellationToken.None)).Image!;
        var failing = new FailingSwapStore(database.CreateStore());

        await Assert.ThrowsAsync<InvalidOperationException>(() => ImageService(failing).ReplaceAsync(hotel.Id, SmallPng(5), CancellationToken.None));

        Assert.Equal(current, await StoredImageAsync(hotel.Id));
        Assert.Equal([current.StorageKey], StoredFiles());
    }

    [Fact]
    public async Task WhenTheFilesystemCannotAcceptTheUpload_TheDatabaseIsNeverTouched()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        var hotel = await StoreHotelAsync();
        var current = (await ImageService().ReplaceAsync(hotel.Id, SmallPng(6), CancellationToken.None)).Image!;
        File.SetUnixFileMode(root, UnixFileMode.UserRead | UnixFileMode.UserExecute);

        await Assert.ThrowsAnyAsync<Exception>(() => ImageService().ReplaceAsync(hotel.Id, SmallPng(7), CancellationToken.None));

        Assert.Equal(current, await StoredImageAsync(hotel.Id));
        Assert.Equal([current.StorageKey], StoredFiles());
    }

    [Fact]
    public async Task ConcurrentUploads_LeaveExactlyTheFileTheHotelReferences()
    {
        var hotel = await StoreHotelAsync();
        var uploads = Enumerable.Range(10, 10).Select(seed => SmallPng(seed)).ToArray();

        var outcomes = await Task.WhenAll(uploads.Select(png =>
            Task.Run(() => ImageService().ReplaceAsync(hotel.Id, png, CancellationToken.None))));

        Assert.All(outcomes, outcome => Assert.Equal(ReplaceHotelImageStatus.Replaced, outcome.Status));
        var current = await StoredImageAsync(hotel.Id);
        Assert.NotNull(current);
        Assert.Equal([current.StorageKey], StoredFiles());
        Assert.Contains(outcomes, outcome => outcome.Image == current);
    }

    [Fact]
    public async Task ConcurrentUploadsRemovalsAndDeletion_NeverLeaveAnUnreferencedOrMissingFile()
    {
        var hotel = await StoreHotelAsync();
        var work = Enumerable.Range(20, 6)
            .Select(seed => Task.Run(() => ImageService().ReplaceAsync(hotel.Id, SmallPng(seed), CancellationToken.None)))
            .Cast<Task>()
            .Concat(Enumerable.Range(0, 3).Select(_ => Task.Run(() => ImageService().RemoveAsync(hotel.Id, CancellationToken.None))))
            .Append(Task.Run(() => HotelService().DeleteAsync(hotel.Id, CancellationToken.None)))
            .ToArray();

        await Task.WhenAll(work);

        Assert.Null(await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None));
        Assert.Empty(StoredFiles());
    }

    [Fact]
    public async Task UploadsRacingWithMetadataUpdates_KeepBothTheNewDetailsAndAReferencedFile()
    {
        var hotel = await StoreHotelAsync();
        var uploads = Enumerable.Range(30, 5)
            .Select(seed => Task.Run(() => ImageService().ReplaceAsync(hotel.Id, SmallPng(seed), CancellationToken.None)))
            .Cast<Task>();
        var updates = Enumerable.Range(0, 5).Select(index => Task.Run(() => HotelService().UpdateAsync(
            hotel.Id,
            new UpdateHotel(new HotelDetailsInput($"Renamed {index}", null, null, null, null, null, null, null, null, null)),
            CancellationToken.None)));

        await Task.WhenAll(uploads.Concat(updates));

        var restored = (await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None))!;
        Assert.StartsWith("Renamed ", restored.Details.Name);
        Assert.NotNull(restored.Image);
        Assert.Equal([restored.Image.StorageKey], StoredFiles());
    }

    private sealed class FailingSwapStore(IHotelStore inner) : IHotelStore
    {
        public Task AddAsync(Hotel hotel, CancellationToken cancellationToken) => inner.AddAsync(hotel, cancellationToken);

        public Task<HotelPage> ListAsync(HotelQuery query, CancellationToken cancellationToken) => inner.ListAsync(query, cancellationToken);

        public Task<Hotel?> FindAsync(Guid hotelId, CancellationToken cancellationToken) => inner.FindAsync(hotelId, cancellationToken);

        public Task<bool> UpdateAsync(Hotel hotel, CancellationToken cancellationToken) => inner.UpdateAsync(hotel, cancellationToken);

        public Task<HotelDeletion> DeleteAsync(Guid hotelId, CancellationToken cancellationToken) => inner.DeleteAsync(hotelId, cancellationToken);

        public Task<ImageSlotChange> ReplaceImageAsync(Guid hotelId, HotelImage image, DateTime nowUtc, CancellationToken cancellationToken) =>
            throw new InvalidOperationException("The database is unavailable.");

        public Task<ImageSlotChange> ClearImageAsync(Guid hotelId, DateTime nowUtc, CancellationToken cancellationToken) =>
            inner.ClearImageAsync(hotelId, nowUtc, cancellationToken);
    }
}
