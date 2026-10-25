namespace HotelManagement.Domain.Hotels;

public sealed record HotelImageSlot
{
    public const int Primary = 0;
    public const int Count = 3;

    public int Position { get; }
    public HotelImage Image { get; }

    public HotelImageSlot(int position, HotelImage image)
    {
        Position = RequireValidPosition(position);
        Image = image ?? throw new DomainValidationException("An image slot requires an image.");
    }

    public static bool IsValidPosition(int position) => position is >= Primary and < Count;

    public static int RequireValidPosition(int position)
    {
        if (!IsValidPosition(position))
        {
            throw new DomainValidationException($"Image position must be between {Primary} and {Count - 1}.");
        }

        return position;
    }
}
