namespace HotelManagement.Application.Images;

public interface IHotelImageService
{
    Task<ReplaceHotelImageOutcome> ReplaceAsync(Guid hotelId, int position, ReadOnlyMemory<byte> content, CancellationToken cancellationToken);

    Task<RemoveHotelImageStatus> RemoveAsync(Guid hotelId, int position, CancellationToken cancellationToken);

    Task<OpenHotelImageOutcome> OpenAsync(Guid hotelId, int position, CancellationToken cancellationToken);

    Task<OpenHotelImageOutcome> OpenActiveAsync(Guid hotelId, int position, CancellationToken cancellationToken);
}
