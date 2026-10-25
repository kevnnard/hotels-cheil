using HotelManagement.Application.Images;

namespace HotelManagement.Application.Tests.Images;

internal sealed class FakeImageOptimizer : IImageOptimizationService
{
    public static readonly OptimizedImage DefaultImage = new([1, 2, 3, 4, 5], "image/webp", 640, 480);

    public ImageOptimizationOutcome Outcome { get; set; } = ImageOptimizationOutcome.Accepted(DefaultImage);

    public List<byte[]> Sources { get; } = [];

    public Task<ImageOptimizationOutcome> OptimizeAsync(ReadOnlyMemory<byte> source, CancellationToken cancellationToken)
    {
        Sources.Add(source.ToArray());
        return Task.FromResult(Outcome);
    }
}
