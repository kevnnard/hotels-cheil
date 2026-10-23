namespace HotelManagement.Application.Hotels;

public sealed record CreateHotel(HotelDetailsInput Details);

public enum CreateHotelStatus
{
    Created,
    InvalidInput
}

public sealed record CreateHotelOutcome(CreateHotelStatus Status, Guid HotelId = default, string? InvalidField = null, string? Message = null)
{
    public static CreateHotelOutcome Created(Guid hotelId) => new(CreateHotelStatus.Created, hotelId);

    public static CreateHotelOutcome InvalidInput(string? field, string message) =>
        new(CreateHotelStatus.InvalidInput, Guid.Empty, field, message);
}
