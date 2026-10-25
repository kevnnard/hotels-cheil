namespace HotelManagement.Application.Hotels;

public sealed record HotelDetailsInput(
    string? Name,
    string? Description,
    string? Street,
    string? City,
    string? Region,
    string? Country,
    string? PostalCode,
    string? Phone,
    string? Email,
    string? Website,
    decimal? PricePerNight = null,
    int? DiscountPercent = null);
