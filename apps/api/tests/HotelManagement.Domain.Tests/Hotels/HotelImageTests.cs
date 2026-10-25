using HotelManagement.Domain.Hotels;

namespace HotelManagement.Domain.Tests.Hotels;

public class HotelImageTests
{
    private const string Key = "0123456789abcdef0123456789abcdef.webp";

    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    [Fact]
    public void Create_KeepsEveryDescriptiveValue()
    {
        var image = new HotelImage(Key, "image/webp", 800, 600, 123_456);

        Assert.Equal(Key, image.StorageKey);
        Assert.Equal("image/webp", image.ContentType);
        Assert.Equal(800, image.Width);
        Assert.Equal(600, image.Height);
        Assert.Equal(123_456, image.SizeBytes);
    }

    [Theory]
    [InlineData("IMAGE/PNG ", "image/png")]
    [InlineData("image/jpeg", "image/jpeg")]
    [InlineData("Image/WebP", "image/webp")]
    public void ContentType_IsNormalizedWhenSupported(string declared, string expected)
    {
        Assert.Equal(expected, new HotelImage(Key, declared, 1, 1, 1).ContentType);
    }

    [Theory]
    [InlineData("image/gif")]
    [InlineData("image/svg+xml")]
    [InlineData("application/pdf")]
    [InlineData("")]
    [InlineData(null)]
    public void ContentType_OutsideTheSupportedSetIsRejected(string? contentType)
    {
        Assert.Throws<DomainValidationException>(() => new HotelImage(Key, contentType, 1, 1, 1));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void StorageKey_IsRequired(string? key)
    {
        Assert.Throws<DomainValidationException>(() => new HotelImage(key, "image/png", 1, 1, 1));
    }

    [Fact]
    public void StorageKey_LongerThanTheLimitIsRejected()
    {
        var key = new string('a', HotelImage.MaximumStorageKeyLength + 1);

        Assert.Throws<DomainValidationException>(() => new HotelImage(key, "image/png", 1, 1, 1));
        Assert.Equal(key[..^1], new HotelImage(key[..^1], "image/png", 1, 1, 1).StorageKey);
    }

    [Theory]
    [InlineData(0, 10)]
    [InlineData(10, 0)]
    [InlineData(-1, 10)]
    [InlineData(10, -5)]
    public void Dimensions_MustBePositive(int width, int height)
    {
        Assert.Throws<DomainValidationException>(() => new HotelImage(Key, "image/png", width, height, 1));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(400_001)]
    public void Size_OutsideTheFourHundredKilobyteBudgetIsRejected(int sizeBytes)
    {
        Assert.Throws<DomainValidationException>(() => new HotelImage(Key, "image/png", 1, 1, sizeBytes));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(400_000)]
    public void Size_AtTheBoundariesIsAccepted(int sizeBytes)
    {
        Assert.Equal(sizeBytes, new HotelImage(Key, "image/png", 1, 1, sizeBytes).SizeBytes);
    }

    [Fact]
    public void Hotel_StartsWithoutAnImageAndRestoresOneWhenStored()
    {
        var image = new HotelImage(Key, "image/png", 10, 10, 100);

        Assert.Null(Hotel.Create(new HotelDetails("Gran Hotel"), CreatedAt).Image);
        Assert.Equal(image, Hotel.Restore(Guid.NewGuid(), new HotelDetails("Gran Hotel"), true, CreatedAt, CreatedAt, [new HotelImageSlot(HotelImageSlot.Primary, image)]).Image);
    }

    [Fact]
    public void Hotel_UpdateAndDeactivationKeepTheImage()
    {
        var image = new HotelImage(Key, "image/png", 10, 10, 100);
        var hotel = Hotel.Restore(Guid.NewGuid(), new HotelDetails("Gran Hotel"), true, CreatedAt, CreatedAt, [new HotelImageSlot(HotelImageSlot.Primary, image)]);

        hotel.Update(new HotelDetails("Renamed"), CreatedAt.AddHours(1));
        hotel.SetActive(false, CreatedAt.AddHours(2));

        Assert.Equal(image, hotel.Image);
    }
}
