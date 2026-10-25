namespace HotelManagement.Application.Images;

public interface IImageOptimizationService
{
    Task<ImageOptimizationOutcome> OptimizeAsync(ReadOnlyMemory<byte> source, CancellationToken cancellationToken);
}
