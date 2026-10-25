using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Images;

public sealed class HotelImageService(
    IHotelStore hotels,
    IImageOptimizationService optimizer,
    IFileStorageService storage,
    TimeProvider clock) : IHotelImageService
{
    public async Task<ReplaceHotelImageOutcome> ReplaceAsync(Guid hotelId, int position, ReadOnlyMemory<byte> content, CancellationToken cancellationToken)
    {
        if (!HotelImageSlot.IsValidPosition(position))
        {
            return ReplaceHotelImageOutcome.PositionNotFound();
        }

        if (content.IsEmpty)
        {
            return ReplaceHotelImageOutcome.Rejected(ImageRejection.Empty, "The image is empty.");
        }

        if (content.Length > ImageLimits.MaximumInputBytes)
        {
            return ReplaceHotelImageOutcome.Rejected(ImageRejection.TooLarge, $"The image exceeds {ImageLimits.MaximumInputBytes} bytes.");
        }

        if (await hotels.FindAsync(hotelId, cancellationToken) is null)
        {
            return ReplaceHotelImageOutcome.HotelNotFound();
        }

        var optimization = await optimizer.OptimizeAsync(content, cancellationToken);
        if (optimization.Image is not { } optimized)
        {
            return ReplaceHotelImageOutcome.Rejected(
                optimization.Rejection ?? ImageRejection.UnsupportedFormat,
                optimization.Message ?? "The image cannot be accepted.");
        }

        var image = new HotelImage(NewStorageKey(optimized.ContentType), optimized.ContentType, optimized.Width, optimized.Height, optimized.Content.Length);
        await storage.SaveAsync(image.StorageKey, optimized.Content, cancellationToken);

        ImageSlotChange change;
        try
        {
            change = await hotels.ReplaceImageAsync(hotelId, position, image, clock.GetUtcNow().UtcDateTime, cancellationToken);
        }
        catch
        {
            await DiscardUnlessAssociatedAsync(hotelId, position, image.StorageKey);
            throw;
        }

        if (!change.HotelFound)
        {
            await storage.DeleteAsync(image.StorageKey);
            return ReplaceHotelImageOutcome.HotelNotFound();
        }

        if (change.Previous is { } previous)
        {
            await storage.DeleteAsync(previous.StorageKey);
        }

        return ReplaceHotelImageOutcome.Replaced(image);
    }

    public async Task<RemoveHotelImageStatus> RemoveAsync(Guid hotelId, int position, CancellationToken cancellationToken)
    {
        if (!HotelImageSlot.IsValidPosition(position))
        {
            return RemoveHotelImageStatus.PositionNotFound;
        }

        var change = await hotels.ClearImageAsync(hotelId, position, clock.GetUtcNow().UtcDateTime, cancellationToken);
        if (!change.HotelFound)
        {
            return RemoveHotelImageStatus.HotelNotFound;
        }

        if (change.Previous is not { } previous)
        {
            return RemoveHotelImageStatus.ImageNotFound;
        }

        await storage.DeleteAsync(previous.StorageKey);
        return RemoveHotelImageStatus.Removed;
    }

    public Task<OpenHotelImageOutcome> OpenAsync(Guid hotelId, int position, CancellationToken cancellationToken) =>
        OpenAsync(hotelId, position, activeOnly: false, cancellationToken);

    public Task<OpenHotelImageOutcome> OpenActiveAsync(Guid hotelId, int position, CancellationToken cancellationToken) =>
        OpenAsync(hotelId, position, activeOnly: true, cancellationToken);

    private async Task<OpenHotelImageOutcome> OpenAsync(Guid hotelId, int position, bool activeOnly, CancellationToken cancellationToken)
    {
        if (!HotelImageSlot.IsValidPosition(position))
        {
            return OpenHotelImageOutcome.PositionNotFound();
        }

        var hotel = await hotels.FindAsync(hotelId, cancellationToken);
        if (hotel is null || (activeOnly && !hotel.IsActive))
        {
            return OpenHotelImageOutcome.HotelNotFound();
        }

        if (hotel.ImageAt(position) is not { } image)
        {
            return OpenHotelImageOutcome.ImageNotFound();
        }

        var content = await storage.OpenReadAsync(image.StorageKey, cancellationToken);
        return content is null ? OpenHotelImageOutcome.ImageNotFound() : OpenHotelImageOutcome.Opened(image, content);
    }

    private async Task DiscardUnlessAssociatedAsync(Guid hotelId, int position, string storageKey)
    {
        try
        {
            var current = await hotels.FindAsync(hotelId, CancellationToken.None);
            if (current?.ImageAt(position)?.StorageKey != storageKey)
            {
                await storage.DeleteAsync(storageKey);
            }
        }
        catch (Exception)
        {
        }
    }

    private static string NewStorageKey(string contentType)
    {
        var extension = contentType switch
        {
            HotelImage.Png => "png",
            HotelImage.Jpeg => "jpg",
            HotelImage.WebP => "webp",
            _ => throw new InvalidOperationException($"No storage extension is defined for {contentType}.")
        };

        return $"{Guid.NewGuid():N}.{extension}";
    }
}
