using HotelManagement.Domain.Hotels;

namespace HotelManagement.Domain.Tests.Hotels;

public class HotelTests
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LaterAt = CreatedAt.AddHours(3);

    private static HotelDetails Details(string name = "Gran Hotel") => new(name);

    [Fact]
    public void Create_StartsActiveWithMatchingUtcTimestamps()
    {
        var hotel = Hotel.Create(Details(), CreatedAt);

        Assert.NotEqual(Guid.Empty, hotel.Id);
        Assert.True(hotel.IsActive);
        Assert.Equal(CreatedAt, hotel.CreatedAtUtc);
        Assert.Equal(CreatedAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void Create_WithNonUtcTimestamp_IsRejected()
    {
        var local = new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Local);

        Assert.Throws<DomainValidationException>(() => Hotel.Create(Details(), local));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Details_RequireName(string? name)
    {
        Assert.Throws<DomainValidationException>(() => new HotelDetails(name));
    }

    [Fact]
    public void Details_TrimNameAndRejectOverlongName()
    {
        Assert.Equal("Gran Hotel", new HotelDetails("  Gran Hotel  ").Name);
        Assert.Throws<DomainValidationException>(() => new HotelDetails(new string('a', 201)));
    }

    [Fact]
    public void Details_TreatBlankOptionalTextAsMissing()
    {
        var details = new HotelDetails(
            "Gran Hotel",
            description: "  ",
            address: new HotelAddress(city: " "),
            contact: new HotelContact(phone: ""));

        Assert.Null(details.Description);
        Assert.Null(details.Address.City);
        Assert.Null(details.Contact.Phone);
    }

    [Theory]
    [InlineData("Name", 200)]
    [InlineData("Description", 2000)]
    [InlineData("Street", 200)]
    [InlineData("City", 100)]
    [InlineData("Region", 100)]
    [InlineData("Country", 100)]
    [InlineData("PostalCode", 20)]
    [InlineData("Phone", 30)]
    [InlineData("Email", 254)]
    [InlineData("Website", 2048)]
    public void Fields_AcceptMaximumLengthAndRejectOneMore(string field, int maxLength)
    {
        var atLimit = ValueOfLength(field, maxLength);
        var overLimit = ValueOfLength(field, maxLength + 1);

        Assert.Equal(atLimit, Read(field, atLimit));
        Assert.Throws<DomainValidationException>(() => Read(field, overLimit));
    }

    private static string ValueOfLength(string field, int length) => field switch
    {
        "Email" => new string('a', length - "@example.com".Length) + "@example.com",
        "Website" => "https://example.com/" + new string('a', length - "https://example.com/".Length),
        "Phone" => new string('1', length),
        _ => new string('a', length)
    };

    private static string? Read(string field, string value) => field switch
    {
        "Name" => new HotelDetails(value).Name,
        "Description" => new HotelDetails("Gran Hotel", description: value).Description,
        "Street" => new HotelAddress(street: value).Street,
        "City" => new HotelAddress(city: value).City,
        "Region" => new HotelAddress(region: value).Region,
        "Country" => new HotelAddress(country: value).Country,
        "PostalCode" => new HotelAddress(postalCode: value).PostalCode,
        "Phone" => new HotelContact(phone: value).Phone,
        "Email" => new HotelContact(email: value).Email,
        "Website" => new HotelContact(website: value).Website,
        _ => throw new ArgumentOutOfRangeException(nameof(field))
    };

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("a b@example.com")]
    [InlineData("@example.com")]
    [InlineData("user@")]
    public void Contact_RejectsMalformedEmail(string email)
    {
        Assert.Throws<DomainValidationException>(() => new HotelContact(email: email));
    }

    [Theory]
    [InlineData("ftp://example.com")]
    [InlineData("example.com")]
    [InlineData("javascript:alert(1)")]
    public void Contact_RejectsNonHttpWebsite(string website)
    {
        Assert.Throws<DomainValidationException>(() => new HotelContact(website: website));
    }

    [Fact]
    public void Contact_AcceptsWellFormedEmailAndWebsite()
    {
        var contact = new HotelContact("+34 600 000 000", "info@example.com", "https://example.com");

        Assert.Equal("info@example.com", contact.Email);
        Assert.Equal("https://example.com", contact.Website);
    }

    [Fact]
    public void Update_ReplacesDetailsAndRefreshesOnlyUpdatedTimestamp()
    {
        var hotel = Hotel.Create(Details(), CreatedAt);

        hotel.Update(Details("Renamed Hotel"), LaterAt);

        Assert.Equal("Renamed Hotel", hotel.Details.Name);
        Assert.Equal(CreatedAt, hotel.CreatedAtUtc);
        Assert.Equal(LaterAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void Update_WithNonUtcTimestamp_LeavesHotelUnchanged()
    {
        var hotel = Hotel.Create(Details(), CreatedAt);
        var local = new DateTime(2026, 10, 23, 15, 0, 0, DateTimeKind.Local);

        Assert.Throws<DomainValidationException>(() => hotel.Update(Details("Renamed Hotel"), local));

        Assert.Equal("Gran Hotel", hotel.Details.Name);
        Assert.Equal(CreatedAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void SetActive_ChangesStateAndTimestampOnlyWhenStateChanges()
    {
        var hotel = Hotel.Create(Details(), CreatedAt);

        hotel.SetActive(true, LaterAt);
        Assert.Equal(CreatedAt, hotel.UpdatedAtUtc);

        hotel.SetActive(false, LaterAt);
        Assert.False(hotel.IsActive);
        Assert.Equal(LaterAt, hotel.UpdatedAtUtc);
    }
}
