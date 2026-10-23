namespace HotelManagement.Domain.Hotels;

public sealed record HotelAddress
{
    public string? Street { get; }
    public string? City { get; }
    public string? Region { get; }
    public string? Country { get; }
    public string? PostalCode { get; }

    public HotelAddress(
        string? street = null,
        string? city = null,
        string? region = null,
        string? country = null,
        string? postalCode = null)
    {
        Street = TextRules.OptionalText(street, "Street", 200);
        City = TextRules.OptionalText(city, "City", 100);
        Region = TextRules.OptionalText(region, "Region", 100);
        Country = TextRules.OptionalText(country, "Country", 100);
        PostalCode = TextRules.OptionalText(postalCode, "Postal code", 20);
    }
}
