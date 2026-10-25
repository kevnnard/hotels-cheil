using HotelManagement.Domain.Hotels;

namespace HotelManagement.Domain.Tests.Hotels;

public class HotelImageSlotTests
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime LaterAt = CreatedAt.AddHours(1);

    private static HotelImage Image(char seed) => new(new string(seed, 32) + ".png", HotelImage.Png, 10, 10, 100);

    private static Hotel Restore(params HotelImageSlot[] slots) =>
        Hotel.Restore(Guid.NewGuid(), new HotelDetails("Gallery Hotel"), true, CreatedAt, CreatedAt, slots);

    [Fact]
    public void TheGallery_HasThreePositionsAndTheFirstIsPrimary()
    {
        Assert.Equal(3, HotelImageSlot.Count);
        Assert.Equal(0, HotelImageSlot.Primary);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void Slot_AcceptsEveryGalleryPosition(int position)
    {
        var slot = new HotelImageSlot(position, Image('a'));

        Assert.Equal(position, slot.Position);
        Assert.Equal(Image('a'), slot.Image);
        Assert.True(HotelImageSlot.IsValidPosition(position));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(int.MinValue)]
    [InlineData(int.MaxValue)]
    public void Slot_RejectsPositionsOutsideTheGallery(int position)
    {
        Assert.False(HotelImageSlot.IsValidPosition(position));
        Assert.Throws<DomainValidationException>(() => new HotelImageSlot(position, Image('a')));
    }

    [Fact]
    public void Slot_RequiresAnImage()
    {
        Assert.Throws<DomainValidationException>(() => new HotelImageSlot(0, null!));
    }

    [Fact]
    public void ANewHotel_HasNoImages()
    {
        var hotel = Hotel.Create(new HotelDetails("Gallery Hotel"), CreatedAt);

        Assert.Empty(hotel.Images);
        Assert.Null(hotel.Image);
    }

    [Fact]
    public void Restore_OrdersTheImagesByPositionAndExposesPositionZeroAsThePrimaryImage()
    {
        var hotel = Restore(new HotelImageSlot(2, Image('c')), new HotelImageSlot(0, Image('a')), new HotelImageSlot(1, Image('b')));

        Assert.Equal([0, 1, 2], hotel.Images.Select(slot => slot.Position));
        Assert.Equal(Image('a'), hotel.Image);
        Assert.Equal(Image('c'), hotel.ImageAt(2));
    }

    [Fact]
    public void Restore_WithoutPositionZero_HasNoPrimaryImage()
    {
        var hotel = Restore(new HotelImageSlot(1, Image('b')));

        Assert.Null(hotel.Image);
        Assert.Null(hotel.ImageAt(0));
        Assert.Equal(Image('b'), hotel.ImageAt(1));
    }

    [Fact]
    public void Restore_RejectsTwoImagesInOnePositionSoAHotelNeverHoldsMoreThanThree()
    {
        Assert.Throws<DomainValidationException>(() => Restore(
            new HotelImageSlot(0, Image('a')),
            new HotelImageSlot(1, Image('b')),
            new HotelImageSlot(2, Image('c')),
            new HotelImageSlot(2, Image('d'))));
    }

    [Fact]
    public void Restore_RejectsOneFileInTwoPositions()
    {
        Assert.Throws<DomainValidationException>(() => Restore(new HotelImageSlot(0, Image('a')), new HotelImageSlot(1, Image('a'))));
    }

    [Fact]
    public void PlaceImage_FillsAnEmptyPositionAndReportsNothingDisplaced()
    {
        var hotel = Restore();

        var displaced = hotel.PlaceImage(1, Image('b'), LaterAt);

        Assert.Null(displaced);
        Assert.Equal(Image('b'), hotel.ImageAt(1));
        Assert.Null(hotel.Image);
        Assert.Equal(LaterAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void PlaceImage_ReplacesOnlyItsPositionAndReturnsTheDisplacedImage()
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')), new HotelImageSlot(1, Image('b')), new HotelImageSlot(2, Image('c')));

        var displaced = hotel.PlaceImage(1, Image('d'), LaterAt);

        Assert.Equal(Image('b'), displaced);
        Assert.Equal([Image('a'), Image('d'), Image('c')], hotel.Images.Select(slot => slot.Image));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    public void PlaceImage_AtAPositionOutsideTheGallery_IsRejectedAndChangesNothing(int position)
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')));

        Assert.Throws<DomainValidationException>(() => hotel.PlaceImage(position, Image('b'), LaterAt));

        Assert.Equal([0], hotel.Images.Select(slot => slot.Position));
        Assert.Equal(CreatedAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void PlaceImage_WithAFileAlreadyHeldByAnotherPosition_IsRejected()
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')));

        Assert.Throws<DomainValidationException>(() => hotel.PlaceImage(1, Image('a'), LaterAt));

        Assert.Null(hotel.ImageAt(1));
    }

    [Fact]
    public void PlaceImage_WithANonUtcTimestamp_IsRejected()
    {
        var hotel = Restore();

        Assert.Throws<DomainValidationException>(() => hotel.PlaceImage(0, Image('a'), DateTime.SpecifyKind(LaterAt, DateTimeKind.Local)));

        Assert.Empty(hotel.Images);
    }

    [Fact]
    public void RemoveImage_ClearsOnlyItsPositionWithoutShiftingTheOthers()
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')), new HotelImageSlot(1, Image('b')), new HotelImageSlot(2, Image('c')));

        var removed = hotel.RemoveImage(0, LaterAt);

        Assert.Equal(Image('a'), removed);
        Assert.Null(hotel.Image);
        Assert.Equal([1, 2], hotel.Images.Select(slot => slot.Position));
        Assert.Equal(LaterAt, hotel.UpdatedAtUtc);
    }

    [Fact]
    public void RemoveImage_OfAnEmptyPosition_ReportsNothingAndKeepsTheTimestamp()
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')));

        Assert.Null(hotel.RemoveImage(2, LaterAt));
        Assert.Equal(CreatedAt, hotel.UpdatedAtUtc);
        Assert.Single(hotel.Images);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    public void ReadingOrRemovingAPositionOutsideTheGallery_IsRejected(int position)
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')));

        Assert.Throws<DomainValidationException>(() => hotel.ImageAt(position));
        Assert.Throws<DomainValidationException>(() => hotel.RemoveImage(position, LaterAt));
        Assert.Single(hotel.Images);
    }

    [Fact]
    public void MetadataUpdatesAndDeactivation_KeepEveryImage()
    {
        var hotel = Restore(new HotelImageSlot(0, Image('a')), new HotelImageSlot(2, Image('c')));

        hotel.Update(new HotelDetails("Renamed"), LaterAt);
        hotel.SetActive(false, LaterAt.AddHours(1));

        Assert.Equal([Image('a'), Image('c')], hotel.Images.Select(slot => slot.Image));
    }
}
