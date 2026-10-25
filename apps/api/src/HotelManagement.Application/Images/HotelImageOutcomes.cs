using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Images;

public enum ReplaceHotelImageStatus
{
    Replaced,
    HotelNotFound,
    PositionNotFound,
    Rejected
}

public sealed record ReplaceHotelImageOutcome(
    ReplaceHotelImageStatus Status,
    HotelImage? Image = null,
    ImageRejection? Rejection = null,
    string? Message = null)
{
    public static ReplaceHotelImageOutcome Replaced(HotelImage image) => new(ReplaceHotelImageStatus.Replaced, image);

    public static ReplaceHotelImageOutcome HotelNotFound() => new(ReplaceHotelImageStatus.HotelNotFound);

    public static ReplaceHotelImageOutcome PositionNotFound() => new(ReplaceHotelImageStatus.PositionNotFound);

    public static ReplaceHotelImageOutcome Rejected(ImageRejection rejection, string message) =>
        new(ReplaceHotelImageStatus.Rejected, null, rejection, message);
}

public enum RemoveHotelImageStatus
{
    Removed,
    HotelNotFound,
    PositionNotFound,
    ImageNotFound
}

public enum OpenHotelImageStatus
{
    Opened,
    HotelNotFound,
    PositionNotFound,
    ImageNotFound
}

public sealed record OpenHotelImageOutcome(OpenHotelImageStatus Status, HotelImage? Image = null, Stream? Content = null)
{
    public static OpenHotelImageOutcome Opened(HotelImage image, Stream content) =>
        new(OpenHotelImageStatus.Opened, image, content);

    public static OpenHotelImageOutcome HotelNotFound() => new(OpenHotelImageStatus.HotelNotFound);

    public static OpenHotelImageOutcome PositionNotFound() => new(OpenHotelImageStatus.PositionNotFound);

    public static OpenHotelImageOutcome ImageNotFound() => new(OpenHotelImageStatus.ImageNotFound);
}
