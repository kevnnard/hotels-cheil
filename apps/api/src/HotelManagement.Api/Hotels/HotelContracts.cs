using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Api.Hotels;

public sealed record HotelRequest(
    string? Name,
    string? Description,
    string? Street,
    string? City,
    string? Region,
    string? Country,
    string? PostalCode,
    string? Phone,
    string? Email,
    string? Website)
{
    public HotelDetailsInput ToInput() =>
        new(Name, Description, Street, City, Region, Country, PostalCode, Phone, Email, Website);
}

public sealed record HotelAddressResponse(string? Street, string? City, string? Region, string? Country, string? PostalCode)
{
    public static HotelAddressResponse From(HotelAddress address) =>
        new(address.Street, address.City, address.Region, address.Country, address.PostalCode);
}

public sealed record HotelContactResponse(string? Phone, string? Email, string? Website)
{
    public static HotelContactResponse From(HotelContact contact) =>
        new(contact.Phone, contact.Email, contact.Website);
}

public sealed record HotelResponse(
    Guid Id,
    string Name,
    string? Description,
    HotelAddressResponse Address,
    HotelContactResponse Contact,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    RatingSummaryResponse Rating)
{
    public static HotelResponse From(HotelSummary hotel) =>
        new(
            hotel.Id,
            hotel.Name,
            hotel.Description,
            HotelAddressResponse.From(hotel.Address),
            HotelContactResponse.From(hotel.Contact),
            hotel.IsActive,
            hotel.CreatedAtUtc,
            hotel.UpdatedAtUtc,
            RatingSummaryResponse.From(hotel.Rating));
}

public sealed record HotelPageResponse(
    IReadOnlyList<HotelResponse> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages)
{
    public static HotelPageResponse From(HotelPage page) =>
        new(page.Items.Select(HotelResponse.From).ToArray(), page.Page, page.PageSize, page.TotalItems, page.TotalPages);
}
