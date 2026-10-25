using System.Globalization;
using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;
using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelPricingPersistenceTests(PostgresDatabaseFixture database)
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private static string NewToken() => Guid.NewGuid().ToString("N");

    private async Task<Hotel> StoreAsync(string name, decimal? price = null, int? discount = null, int order = 0)
    {
        var hotel = Hotel.Create(new HotelDetails(name, pricing: HotelPricing.From(price, discount)), CreatedAt.AddMinutes(order));
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel;
    }

    private Task<HotelPage> ListAsync(string token, decimal? maximumPrice, decimal? minimumRating = null, int page = 1, int pageSize = 20) =>
        database.CreateStore().ListAsync(
            new HotelQuery { Name = token, MaximumPrice = maximumPrice, MinimumRating = minimumRating, Page = page, PageSize = pageSize },
            CancellationToken.None);

    [Fact]
    public async Task PricedHotel_RoundTripsItsPricing()
    {
        var hotel = await StoreAsync($"Priced {NewToken()}", 199.99m, 15);

        var restored = (await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None))!;

        Assert.Equal(hotel.Details, restored.Details);
        Assert.Equal(199.99m, restored.Details.Pricing!.NightlyRate);
        Assert.Equal(15, restored.Details.Pricing.DiscountPercent);
        Assert.Equal(169.99m, restored.Details.Pricing.DiscountedNightlyRate);
    }

    [Fact]
    public async Task HotelWithoutPricing_RoundTripsWithoutPricing()
    {
        var hotel = await StoreAsync($"Unpriced {NewToken()}");

        var restored = (await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None))!;

        Assert.Null(restored.Details.Pricing);
    }

    [Fact]
    public async Task Update_ReplacesAndClearsThePricing()
    {
        var hotel = await StoreAsync($"Changing {NewToken()}", 300m, 10);
        var store = database.CreateStore();

        hotel.Update(new HotelDetails(hotel.Details.Name, pricing: HotelPricing.From(250.5m, null)), CreatedAt.AddHours(1));
        await store.UpdateAsync(hotel, CancellationToken.None);
        var repriced = (await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None))!;

        hotel.Update(new HotelDetails(hotel.Details.Name), CreatedAt.AddHours(2));
        await database.CreateStore().UpdateAsync(hotel, CancellationToken.None);
        var cleared = (await database.CreateStore().FindAsync(hotel.Id, CancellationToken.None))!;

        Assert.Equal(HotelPricing.From(250.5m, null), repriced.Details.Pricing);
        Assert.Null(cleared.Details.Pricing);
    }

    [Fact]
    public async Task MaximumPrice_KeepsHotelsWhoseEffectiveRateIsWithinItAndExcludesUnpricedOnes()
    {
        var token = NewToken();
        var plain = await StoreAsync($"Plain {token}", 100m, order: 1);
        var discounted = await StoreAsync($"Discounted {token}", 200m, 50, order: 2);
        await StoreAsync($"Above {token}", 150m, order: 3);
        await StoreAsync($"DiscountedAbove {token}", 200m, 10, order: 4);
        await StoreAsync($"Unpriced {token}", order: 5);

        var page = await ListAsync(token, 100m);

        Assert.Equal([plain.Id, discounted.Id], page.Items.Select(item => item.Id).ToArray());
        Assert.Equal(2, page.TotalItems);
        Assert.Equal(HotelPricing.From(200m, 50), page.Items[1].Pricing);
    }

    [Fact]
    public async Task WithoutMaximumPrice_UnpricedHotelsAreListedWithNullPricing()
    {
        var token = NewToken();
        await StoreAsync($"Priced {token}", 100m, order: 1);
        await StoreAsync($"Unpriced {token}", order: 2);

        var page = await ListAsync(token, null);

        Assert.Equal(2, page.TotalItems);
        Assert.Null(page.Items[1].Pricing);
    }

    [Theory]
    [InlineData("8.58", 0)]
    [InlineData("8.585", 0)]
    [InlineData("8.59", 1)]
    public async Task MaximumPrice_ComparesTheDiscountedRateRoundedToCentsAwayFromZero(string maximumPrice, int expected)
    {
        var token = NewToken();
        await StoreAsync($"Midpoint {token}", 10.10m, 15);

        var page = await ListAsync(token, decimal.Parse(maximumPrice, CultureInfo.InvariantCulture));

        Assert.Equal(expected, page.TotalItems);
    }

    [Fact]
    public async Task MaximumPrice_CombinesWithNameAndMinimumRating()
    {
        var token = NewToken();
        var cheapLiked = await StoreAsync($"CheapLiked {token}", 90m, order: 1);
        var cheapDisliked = await StoreAsync($"CheapDisliked {token}", 300m, 75, order: 2);
        var dearLiked = await StoreAsync($"DearLiked {token}", 500m, order: 3);
        await StoreAsync($"Cheap {NewToken()}", 50m, order: 4);
        await RateAsync(cheapLiked.Id, 5m);
        await RateAsync(cheapDisliked.Id, 2m);
        await RateAsync(dearLiked.Id, 5m);

        var page = await ListAsync(token, 100m, minimumRating: 4m);

        Assert.Equal(cheapLiked.Id, Assert.Single(page.Items).Id);
        Assert.Equal(1, page.TotalItems);
    }

    [Fact]
    public async Task MaximumPrice_KeepsThePaginationCountsOfTheFilteredSet()
    {
        var token = NewToken();
        for (var index = 0; index < 5; index++)
        {
            await StoreAsync($"Cheap {index} {token}", 100m + index, order: index);
        }

        await StoreAsync($"Dear {token}", 900m, order: 9);
        await StoreAsync($"Unpriced {token}", order: 10);

        var first = await ListAsync(token, 200m, page: 1, pageSize: 2);
        var last = await ListAsync(token, 200m, page: 3, pageSize: 2);

        Assert.Equal((5, 3), (first.TotalItems, first.TotalPages));
        Assert.Equal(2, first.Items.Count);
        Assert.Equal($"Cheap 4 {token}", Assert.Single(last.Items).Name);
    }

    private async Task RateAsync(Guid hotelId, decimal score) =>
        await database.CreateRatingStore().RateAsync(hotelId, Guid.NewGuid(), score, CancellationToken.None);
}
