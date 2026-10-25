using HotelManagement.Domain.Hotels;

namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelImageRecord
{
    public Guid HotelId { get; set; }
    public int Position { get; set; }
    public string StorageKey { get; set; } = string.Empty;
    public string ContentType { get; set; } = string.Empty;
    public int Width { get; set; }
    public int Height { get; set; }
    public int SizeBytes { get; set; }

    public HotelImage ToImage() => new(StorageKey, ContentType, Width, Height, SizeBytes);

    public HotelImageSlot ToSlot() => new(Position, ToImage());
}
