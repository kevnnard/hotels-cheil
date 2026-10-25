using System.Text.RegularExpressions;
using HotelManagement.Application.Images;
using HotelManagement.Application.Tests.Hotels;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Tests.Images;

public class HotelImageServiceTests
{
    private static readonly DateTime Now = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Earlier = new(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);
    private static readonly byte[] Upload = [9, 9, 9];

    private readonly FakeHotelStore hotels = new();
    private readonly FakeImageOptimizer optimizer = new();
    private readonly FakeFileStorage storage = new();

    private HotelImageService Service => new(hotels, optimizer, storage, new FixedTimeProvider(Now));

    private Hotel SeedHotel(HotelImage? image = null)
    {
        var seeded = Hotel.Restore(Guid.NewGuid(), new HotelDetails("Grand Plaza"), true, Earlier, Earlier, image);
        hotels.Seed(seeded);
        return seeded;
    }

    private HotelImage SeedStoredImage(string key)
    {
        storage.Seed(key, [7, 7, 7]);
        return new HotelImage(key, HotelImage.Png, 10, 10, 3);
    }

    private async Task<HotelImage?> StoredImageOf(Guid hotelId) =>
        (await hotels.FindAsync(hotelId, CancellationToken.None))!.Image;

    [Fact]
    public async Task Replace_stores_the_optimized_bytes_and_associates_their_metadata()
    {
        var hotel = SeedHotel();

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.Replaced, outcome.Status);
        var stored = await StoredImageOf(hotel.Id);
        Assert.NotNull(stored);
        Assert.Equal(outcome.Image, stored);
        Assert.Equal(HotelImage.WebP, stored.ContentType);
        Assert.Equal((640, 480, 5), (stored.Width, stored.Height, stored.SizeBytes));
        Assert.Equal(FakeImageOptimizer.DefaultImage.Content, storage.Content(stored.StorageKey));
        Assert.Equal(Upload, Assert.Single(optimizer.Sources));
        Assert.Equal(Now, (await hotels.FindAsync(hotel.Id, CancellationToken.None))!.UpdatedAtUtc);
    }

    [Theory]
    [InlineData(HotelImage.Png, ".png")]
    [InlineData(HotelImage.Jpeg, ".jpg")]
    [InlineData(HotelImage.WebP, ".webp")]
    public async Task Replace_generates_an_opaque_key_with_an_extension_matching_the_content(string contentType, string extension)
    {
        optimizer.Outcome = ImageOptimizationOutcome.Accepted(new OptimizedImage([1], contentType, 1, 1));
        var hotel = SeedHotel();

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.Matches(new Regex($"^[0-9a-f]{{32}}{Regex.Escape(extension)}$"), outcome.Image!.StorageKey);
    }

    [Fact]
    public async Task Replace_uses_a_new_key_for_every_upload_and_removes_the_previous_bytes_after_associating()
    {
        var previous = SeedStoredImage("a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png");
        var hotel = SeedHotel(previous);

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.NotEqual(previous.StorageKey, outcome.Image!.StorageKey);
        Assert.Equal(outcome.Image, await StoredImageOf(hotel.Id));
        Assert.Equal([outcome.Image.StorageKey], storage.Keys);
        Assert.Equal([previous.StorageKey], storage.DeleteRequests);
    }

    [Fact]
    public async Task Replace_reports_rejections_without_storing_or_changing_anything()
    {
        var previous = SeedStoredImage("a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png");
        var hotel = SeedHotel(previous);
        optimizer.Outcome = ImageOptimizationOutcome.Rejected(ImageRejection.ExceedsByteBudget, "Too heavy.");

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.Rejected, outcome.Status);
        Assert.Equal(ImageRejection.ExceedsByteBudget, outcome.Rejection);
        Assert.Equal("Too heavy.", outcome.Message);
        Assert.Equal(previous, await StoredImageOf(hotel.Id));
        Assert.Equal([previous.StorageKey], storage.Keys);
        Assert.Empty(storage.DeleteRequests);
        Assert.Empty(hotels.ReplacedImages);
        Assert.Equal(Earlier, (await hotels.FindAsync(hotel.Id, CancellationToken.None))!.UpdatedAtUtc);
    }

    [Fact]
    public async Task Replace_for_an_unknown_hotel_stores_nothing_and_never_decodes()
    {
        var outcome = await Service.ReplaceAsync(Guid.NewGuid(), Upload, CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.HotelNotFound, outcome.Status);
        Assert.Empty(optimizer.Sources);
        Assert.Empty(storage.Keys);
    }

    [Fact]
    public async Task Replace_rejects_empty_content_before_decoding()
    {
        var hotel = SeedHotel();

        var outcome = await Service.ReplaceAsync(hotel.Id, ReadOnlyMemory<byte>.Empty, CancellationToken.None);

        Assert.Equal(ImageRejection.Empty, outcome.Rejection);
        Assert.Empty(optimizer.Sources);
        Assert.Empty(storage.Keys);
    }

    [Fact]
    public async Task Replace_accepts_content_at_the_input_ceiling_and_rejects_one_byte_above_it()
    {
        var hotel = SeedHotel();

        var atCeiling = await Service.ReplaceAsync(hotel.Id, new byte[ImageLimits.MaximumInputBytes], CancellationToken.None);
        var above = await Service.ReplaceAsync(hotel.Id, new byte[ImageLimits.MaximumInputBytes + 1], CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.Replaced, atCeiling.Status);
        Assert.Equal(ImageRejection.TooLarge, above.Rejection);
        Assert.Single(optimizer.Sources);
        Assert.Equal(atCeiling.Image, await StoredImageOf(hotel.Id));
    }

    [Fact]
    public async Task Replace_discards_the_staged_bytes_when_the_hotel_disappears_before_the_swap()
    {
        var hotel = SeedHotel();
        hotels.ReplaceFindsHotel = false;

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.HotelNotFound, outcome.Status);
        Assert.Empty(storage.Keys);
        Assert.Single(storage.DeleteRequests);
    }

    [Fact]
    public async Task Replace_compensates_the_staged_bytes_and_keeps_the_current_image_when_the_swap_fails()
    {
        var previous = SeedStoredImage("a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png");
        var hotel = SeedHotel(previous);
        hotels.ReplaceFailure = new InvalidOperationException("database unavailable");

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None));

        Assert.Equal(previous, await StoredImageOf(hotel.Id));
        Assert.Equal([previous.StorageKey], storage.Keys);
        Assert.Single(storage.DeleteRequests);
        Assert.NotEqual(previous.StorageKey, storage.DeleteRequests[0]);
    }

    [Fact]
    public async Task Replace_keeps_the_staged_bytes_when_the_swap_failed_after_it_was_applied()
    {
        var hotel = SeedHotel();
        hotels.ReplaceFailure = new InvalidOperationException("connection lost after commit");
        hotels.ReplaceFailureAfterApplying = true;

        await Assert.ThrowsAsync<InvalidOperationException>(() => Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None));

        var stored = await StoredImageOf(hotel.Id);
        Assert.NotNull(stored);
        Assert.Equal([stored.StorageKey], storage.Keys);
        Assert.Empty(storage.DeleteRequests);
    }

    [Fact]
    public async Task Replace_does_not_touch_the_database_when_staging_the_bytes_fails()
    {
        var previous = SeedStoredImage("a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png");
        var hotel = SeedHotel(previous);
        storage.SaveFailure = new IOException("disk full");

        await Assert.ThrowsAsync<IOException>(() => Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None));

        Assert.Equal(previous, await StoredImageOf(hotel.Id));
        Assert.Empty(hotels.ReplacedImages);
        Assert.Equal([previous.StorageKey], storage.Keys);
    }

    [Fact]
    public async Task Replace_still_succeeds_when_the_previous_bytes_cannot_be_deleted()
    {
        var previous = SeedStoredImage("a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1.png");
        var hotel = SeedHotel(previous);
        storage.UndeletableKeys.Add(previous.StorageKey);

        var outcome = await Service.ReplaceAsync(hotel.Id, Upload, CancellationToken.None);

        Assert.Equal(ReplaceHotelImageStatus.Replaced, outcome.Status);
        Assert.Equal(outcome.Image, await StoredImageOf(hotel.Id));
        Assert.Contains(previous.StorageKey, storage.Keys);
        Assert.Contains(outcome.Image!.StorageKey, storage.Keys);
    }

    [Fact]
    public async Task Remove_clears_the_association_and_deletes_the_bytes()
    {
        var image = SeedStoredImage("b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2.png");
        var hotel = SeedHotel(image);

        var status = await Service.RemoveAsync(hotel.Id, CancellationToken.None);

        Assert.Equal(RemoveHotelImageStatus.Removed, status);
        Assert.Null(await StoredImageOf(hotel.Id));
        Assert.Empty(storage.Keys);
        Assert.Equal([image.StorageKey], storage.DeleteRequests);
        Assert.Equal(Now, (await hotels.FindAsync(hotel.Id, CancellationToken.None))!.UpdatedAtUtc);
    }

    [Fact]
    public async Task Remove_without_an_image_reports_it_and_deletes_nothing()
    {
        var hotel = SeedHotel();

        var status = await Service.RemoveAsync(hotel.Id, CancellationToken.None);

        Assert.Equal(RemoveHotelImageStatus.ImageNotFound, status);
        Assert.Empty(storage.DeleteRequests);
        Assert.Equal(Earlier, (await hotels.FindAsync(hotel.Id, CancellationToken.None))!.UpdatedAtUtc);
    }

    [Fact]
    public async Task Remove_for_an_unknown_hotel_reports_it()
    {
        Assert.Equal(RemoveHotelImageStatus.HotelNotFound, await Service.RemoveAsync(Guid.NewGuid(), CancellationToken.None));
        Assert.Empty(storage.DeleteRequests);
    }

    [Fact]
    public async Task Remove_still_succeeds_when_the_bytes_cannot_be_deleted()
    {
        var image = SeedStoredImage("b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2.png");
        var hotel = SeedHotel(image);
        storage.UndeletableKeys.Add(image.StorageKey);

        var status = await Service.RemoveAsync(hotel.Id, CancellationToken.None);

        Assert.Equal(RemoveHotelImageStatus.Removed, status);
        Assert.Null(await StoredImageOf(hotel.Id));
        Assert.Equal([image.StorageKey], storage.Keys);
    }

    [Fact]
    public async Task Open_returns_the_metadata_and_a_stream_of_the_stored_bytes()
    {
        var image = SeedStoredImage("c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3c3.png");
        var hotel = SeedHotel(image);

        var outcome = await Service.OpenAsync(hotel.Id, CancellationToken.None);

        Assert.Equal(OpenHotelImageStatus.Opened, outcome.Status);
        Assert.Equal(image, outcome.Image);
        await using var content = outcome.Content!;
        using var copy = new MemoryStream();
        await content.CopyToAsync(copy);
        Assert.Equal([7, 7, 7], copy.ToArray());
    }

    [Fact]
    public async Task Open_distinguishes_unknown_hotels_missing_images_and_missing_bytes()
    {
        var withoutImage = SeedHotel();
        var withoutBytes = SeedHotel(new HotelImage("d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4d4.png", HotelImage.Png, 1, 1, 1));

        Assert.Equal(OpenHotelImageStatus.HotelNotFound, (await Service.OpenAsync(Guid.NewGuid(), CancellationToken.None)).Status);
        Assert.Equal(OpenHotelImageStatus.ImageNotFound, (await Service.OpenAsync(withoutImage.Id, CancellationToken.None)).Status);
        Assert.Equal(OpenHotelImageStatus.ImageNotFound, (await Service.OpenAsync(withoutBytes.Id, CancellationToken.None)).Status);
    }
}
