namespace HotelManagement.Domain.Hotels;

public sealed record HotelDetails
{
    public string Name { get; }
    public string? Description { get; }
    public HotelAddress Address { get; }
    public HotelContact Contact { get; }
    public HotelPricing? Pricing { get; }

    public HotelDetails(
        string? name,
        string? description = null,
        HotelAddress? address = null,
        HotelContact? contact = null,
        HotelPricing? pricing = null)
    {
        Name = TextRules.RequiredText(name, "Name", 200);
        Description = TextRules.OptionalText(description, "Description", 2000);
        Address = address ?? new HotelAddress();
        Contact = contact ?? new HotelContact();
        Pricing = pricing;
    }
}
