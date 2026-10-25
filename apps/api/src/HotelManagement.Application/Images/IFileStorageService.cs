namespace HotelManagement.Application.Images;

public interface IFileStorageService
{
    Task SaveAsync(string key, ReadOnlyMemory<byte> content, CancellationToken cancellationToken);

    Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken);

    Task DeleteAsync(string key);
}
