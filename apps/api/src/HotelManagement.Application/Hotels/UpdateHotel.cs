namespace HotelManagement.Application.Hotels;

public sealed record UpdateHotel(HotelDetailsInput Details);

public enum UpdateHotelStatus
{
    Updated,
    NotFound,
    InvalidInput
}

public sealed record UpdateHotelOutcome(UpdateHotelStatus Status, HotelSummary? Hotel = null, string? InvalidField = null, string? Message = null)
{
    public static UpdateHotelOutcome Updated(HotelSummary hotel) => new(UpdateHotelStatus.Updated, hotel);

    public static UpdateHotelOutcome NotFound() => new(UpdateHotelStatus.NotFound);

    public static UpdateHotelOutcome InvalidInput(string? field, string message) =>
        new(UpdateHotelStatus.InvalidInput, null, field, message);
}
