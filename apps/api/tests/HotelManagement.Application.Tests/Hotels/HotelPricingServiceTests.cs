using System.Globalization;
using HotelManagement.Application.Hotels;
using HotelManagement.Application.Tests.Images;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Tests.Hotels;

public class HotelPricingServiceTests
{
    private static readonly DateTime Now = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Earlier = new(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);

    private readonly FakeHotelStore hotels = new();
    private readonly FakeHotelRatingsStore ratings = new();
    private readonly FakeFileStorage storage = new();
    private readonly FixedTimeProvider clock = new(Now);

    private HotelService Service => new(hotels, ratings, storage, clock);

    private static HotelDetailsInput Input(decimal? pricePerNight, int? discountPercent) =>
        new("Grand Plaza", null, null, "Lisbon", null, null, null, null, null, null, pricePerNight, discountPercent);

    private Hotel SeedPricedHotel()
    {
        var hotel = Hotel.Create(new HotelDetails("Priced", pricing: HotelPricing.From(300m, 25)), Earlier);
        hotels.Seed(hotel);
        return hotel;
    }

    [Fact]
    public async Task Create_WithPriceAndDiscount_StoresThePricing()
    {
        var outcome = await Service.CreateAsync(new CreateHotel(Input(199.99m, 15)), CancellationToken.None);

        Assert.Equal(CreateHotelStatus.Created, outcome.Status);
        var pricing = Assert.Single(hotels.Added).Details.Pricing!;
        Assert.Equal(199.99m, pricing.NightlyRate);
        Assert.Equal(15, pricing.DiscountPercent);
        Assert.Equal(169.99m, pricing.DiscountedNightlyRate);
    }

    [Fact]
    public async Task Create_WithoutPricing_StoresNoPricing()
    {
        await Service.CreateAsync(new CreateHotel(Input(null, null)), CancellationToken.None);

        Assert.Null(Assert.Single(hotels.Added).Details.Pricing);
    }

    [Theory]
    [InlineData("0", null, "pricePerNight", "Price per night must be greater than 0.")]
    [InlineData("-5", null, "pricePerNight", "Price per night must be greater than 0.")]
    [InlineData("100000.01", null, "pricePerNight", "Price per night cannot exceed 100000.")]
    [InlineData("10.123", 10, "pricePerNight", "Price per night cannot have more than two decimals.")]
    [InlineData("100", 0, "discountPercent", "Discount percent must be between 1 and 90.")]
    [InlineData("100", 91, "discountPercent", "Discount percent must be between 1 and 90.")]
    [InlineData(null, 10, "discountPercent", "A discount requires a nightly price.")]
    public async Task Create_WithInvalidPricing_ReportsTheFieldAndStoresNothing(string? price, int? discount, string field, string message)
    {
        var input = Input(price is null ? null : decimal.Parse(price, CultureInfo.InvariantCulture), discount);

        var outcome = await Service.CreateAsync(new CreateHotel(input), CancellationToken.None);

        Assert.Equal(CreateHotelStatus.InvalidInput, outcome.Status);
        Assert.Equal(field, outcome.InvalidField);
        Assert.Equal(message, outcome.Message);
        Assert.Empty(hotels.Added);
    }

    [Fact]
    public async Task Create_WithAMissingNameAndInvalidPricing_ReportsTheNameFirst()
    {
        var input = Input(null, 10) with { Name = " " };

        var outcome = await Service.CreateAsync(new CreateHotel(input), CancellationToken.None);

        Assert.Equal("name", outcome.InvalidField);
    }

    [Fact]
    public async Task Update_WithoutPricingFields_ClearsThePricing()
    {
        var hotel = SeedPricedHotel();

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(Input(null, null)), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.Updated, outcome.Status);
        Assert.Null(outcome.Hotel!.Pricing);
        Assert.Null(Assert.Single(hotels.Updated).Details.Pricing);
    }

    [Fact]
    public async Task Update_WithNewPricing_ReturnsTheSummaryWithIt()
    {
        var hotel = SeedPricedHotel();

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(Input(420m, null)), CancellationToken.None);

        Assert.Equal(HotelPricing.From(420m, null), outcome.Hotel!.Pricing);
    }

    [Fact]
    public async Task Update_WithInvalidPricing_KeepsTheStoredHotel()
    {
        var hotel = SeedPricedHotel();

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(Input(null, 20)), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.InvalidInput, outcome.Status);
        Assert.Equal("discountPercent", outcome.InvalidField);
        Assert.Empty(hotels.Updated);
    }

    [Fact]
    public async Task Find_ReturnsThePricingOfTheHotel()
    {
        var hotel = SeedPricedHotel();

        var summary = await Service.FindAsync(hotel.Id, CancellationToken.None);

        Assert.Equal(HotelPricing.From(300m, 25), summary!.Pricing);
        Assert.Equal(225m, summary.Pricing!.DiscountedNightlyRate);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("-0.01")]
    public async Task List_WithAMaximumPriceThatIsNotPositive_IsRejectedWithoutCallingTheStore(string maximumPrice)
    {
        var query = new HotelQuery { MaximumPrice = decimal.Parse(maximumPrice, CultureInfo.InvariantCulture) };

        var outcome = await Service.ListAsync(query, CancellationToken.None);

        Assert.Equal(ListHotelsStatus.InvalidQuery, outcome.Status);
        Assert.Empty(hotels.ListedQueries);
    }

    [Fact]
    public async Task List_WithAPositiveMaximumPrice_ReachesTheStoreWithTheSameQuery()
    {
        var query = new HotelQuery { Name = "plaza", MinimumRating = 4m, MaximumPrice = 0.01m };

        var outcome = await Service.ListAsync(query, CancellationToken.None);

        Assert.Equal(ListHotelsStatus.Listed, outcome.Status);
        Assert.Equal(0.01m, Assert.Single(hotels.ListedQueries).MaximumPrice);
    }
}
