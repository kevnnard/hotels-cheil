namespace HotelManagement.Application.Images;

public enum ImageRejection
{
    Empty,
    TooLarge,
    Corrupt,
    UnsupportedFormat,
    Animated,
    DimensionsExceeded,
    UnsupportedRepresentation,
    ExceedsByteBudget
}

public sealed record OptimizedImage(byte[] Content, string ContentType, int Width, int Height);

public sealed record ImageOptimizationOutcome(OptimizedImage? Image, ImageRejection? Rejection = null, string? Message = null)
{
    public bool IsAccepted => Image is not null;

    public static ImageOptimizationOutcome Accepted(OptimizedImage image) => new(image);

    public static ImageOptimizationOutcome Rejected(ImageRejection rejection, string message) =>
        new(null, rejection, message);
}
