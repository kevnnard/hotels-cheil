namespace HotelManagement.Application.Images;

public interface IHotelImageService
{
    Task<ReplaceHotelImageOutcome> ReplaceAsync(Guid hotelId, ReadOnlyMemory<byte> content, CancellationToken cancellationToken);

    Task<RemoveHotelImageStatus> RemoveAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<OpenHotelImageOutcome> OpenAsync(Guid hotelId, CancellationToken cancellationToken);

    Task<OpenHotelImageOutcome> OpenActiveAsync(Guid hotelId, CancellationToken cancellationToken);
}
