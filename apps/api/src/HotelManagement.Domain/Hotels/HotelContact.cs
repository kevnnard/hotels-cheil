namespace HotelManagement.Domain.Hotels;

public sealed record HotelContact
{
    public string? Phone { get; }
    public string? Email { get; }
    public string? Website { get; }

    public HotelContact(string? phone = null, string? email = null, string? website = null)
    {
        Phone = TextRules.OptionalText(phone, "Phone", 30);
        Email = TextRules.OptionalEmail(email);
        Website = TextRules.OptionalWebsite(website);
    }
}
