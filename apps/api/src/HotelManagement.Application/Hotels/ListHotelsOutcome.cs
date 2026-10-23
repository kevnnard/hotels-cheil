namespace HotelManagement.Application.Hotels;

public enum ListHotelsStatus
{
    Listed,
    InvalidQuery
}

public sealed record ListHotelsOutcome(ListHotelsStatus Status, HotelPage? Page = null, string? Message = null)
{
    public static ListHotelsOutcome Listed(HotelPage page) => new(ListHotelsStatus.Listed, page);

    public static ListHotelsOutcome InvalidQuery(string message) => new(ListHotelsStatus.InvalidQuery, null, message);
}
