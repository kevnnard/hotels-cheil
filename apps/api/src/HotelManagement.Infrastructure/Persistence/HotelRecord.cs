using HotelManagement.Domain.Hotels;

namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelRecord
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Street { get; set; }
    public string? City { get; set; }
    public string? Region { get; set; }
    public string? Country { get; set; }
    public string? PostalCode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Website { get; set; }
    public string? ImageStorageKey { get; set; }
    public string? ImageContentType { get; set; }
    public int? ImageWidth { get; set; }
    public int? ImageHeight { get; set; }
    public int? ImageSizeBytes { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }

    public static HotelRecord From(Hotel hotel)
    {
        var record = new HotelRecord { Id = hotel.Id, CreatedAtUtc = hotel.CreatedAtUtc };
        record.CopyFrom(hotel);
        return record;
    }

    public void CopyFrom(Hotel hotel)
    {
        var details = hotel.Details;
        Name = details.Name;
        Description = details.Description;
        Street = details.Address.Street;
        City = details.Address.City;
        Region = details.Address.Region;
        Country = details.Address.Country;
        PostalCode = details.Address.PostalCode;
        Phone = details.Contact.Phone;
        Email = details.Contact.Email;
        Website = details.Contact.Website;
        IsActive = hotel.IsActive;
        UpdatedAtUtc = hotel.UpdatedAtUtc;
    }

    public Hotel ToDomain()
    {
        var details = new HotelDetails(
            Name,
            Description,
            new HotelAddress(Street, City, Region, Country, PostalCode),
            new HotelContact(Phone, Email, Website));

        return Hotel.Restore(
            Id,
            details,
            IsActive,
            DateTime.SpecifyKind(CreatedAtUtc, DateTimeKind.Utc),
            DateTime.SpecifyKind(UpdatedAtUtc, DateTimeKind.Utc),
            ToImage());
    }

    public HotelImage? ToImage() =>
        ImageStorageKey is null
            ? null
            : new HotelImage(ImageStorageKey, ImageContentType, ImageWidth.GetValueOrDefault(), ImageHeight.GetValueOrDefault(), ImageSizeBytes.GetValueOrDefault());
}
