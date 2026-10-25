namespace HotelManagement.Domain.Hotels;

public sealed record HotelImage
{
    public const int MaximumBytes = 400_000;
    public const int MaximumStorageKeyLength = 64;

    public const string Png = "image/png";
    public const string Jpeg = "image/jpeg";
    public const string WebP = "image/webp";

    private static readonly string[] SupportedContentTypes = [Png, Jpeg, WebP];

    public string StorageKey { get; }
    public string ContentType { get; }
    public int Width { get; }
    public int Height { get; }
    public int SizeBytes { get; }

    public HotelImage(string? storageKey, string? contentType, int width, int height, int sizeBytes)
    {
        StorageKey = TextRules.RequiredText(storageKey, "Image storage key", MaximumStorageKeyLength);
        ContentType = RequireSupportedContentType(contentType);
        Width = RequirePositive(width, "Image width");
        Height = RequirePositive(height, "Image height");
        SizeBytes = RequireWithinBudget(sizeBytes);
    }

    private static string RequireSupportedContentType(string? contentType)
    {
        var normalized = contentType?.Trim().ToLowerInvariant();
        if (normalized is null || !SupportedContentTypes.Contains(normalized))
        {
            throw new DomainValidationException("Image content type must be image/png, image/jpeg or image/webp.");
        }

        return normalized;
    }

    private static int RequirePositive(int value, string field)
    {
        if (value <= 0)
        {
            throw new DomainValidationException($"{field} must be greater than zero.");
        }

        return value;
    }

    private static int RequireWithinBudget(int sizeBytes)
    {
        if (sizeBytes <= 0 || sizeBytes > MaximumBytes)
        {
            throw new DomainValidationException($"Image size must be between 1 and {MaximumBytes} bytes.");
        }

        return sizeBytes;
    }
}
