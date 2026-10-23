using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;
using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelListingPersistenceTests(PostgresDatabaseFixture database)
{
    private static readonly DateTime CreatedAt = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private static string NewToken() => Guid.NewGuid().ToString("N");

    private async Task<Guid> StoreHotelAsync(string name, DateTime? createdAt = null)
    {
        var hotel = Hotel.Create(new HotelDetails(name), createdAt ?? CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);
        return hotel.Id;
    }

    private async Task RateAsync(Guid hotelId, decimal score) =>
        await database.CreateRatingStore().RateAsync(hotelId, Guid.NewGuid(), score, CancellationToken.None);

    private Task<HotelPage> ListAsync(string token, decimal? minimumRating = null, int page = 1, int pageSize = 20) =>
        database.CreateStore().ListAsync(
            new HotelQuery { Name = token, MinimumRating = minimumRating, Page = page, PageSize = pageSize },
            CancellationToken.None);

    [Fact]
    public async Task NoMatchingHotel_ReturnsAnEmptyPage()
    {
        var page = await ListAsync(NewToken());

        Assert.Empty(page.Items);
        Assert.Equal(0, page.TotalItems);
        Assert.Equal(0, page.TotalPages);
        Assert.Equal(1, page.Page);
        Assert.Equal(20, page.PageSize);
    }

    [Fact]
    public async Task NameFilter_MatchesPartOfTheNameAndExcludesOtherHotels()
    {
        var token = NewToken();
        var matching = await StoreHotelAsync($"Grand {token} Resort");
        await StoreHotelAsync($"Other {NewToken()} Inn");

        var page = await ListAsync(token);

        var item = Assert.Single(page.Items);
        Assert.Equal(matching, item.Id);
        Assert.Equal($"Grand {token} Resort", item.Name);
        Assert.Equal(1, page.TotalItems);
    }

    [Fact]
    public async Task NameFilter_IgnoresLetterCase()
    {
        var token = NewToken();
        var hotelId = await StoreHotelAsync($"Mixed {token.ToUpperInvariant()} Case");

        var page = await ListAsync(token.ToLowerInvariant());

        Assert.Equal(hotelId, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task NameFilter_TreatsWildcardCharactersAsLiteralText()
    {
        var token = NewToken();
        await StoreHotelAsync($"{token} Plain");
        var literal = await StoreHotelAsync($"{token}%_Literal");

        var page = await database.CreateStore().ListAsync(
            new HotelQuery { Name = $"{token}%_" },
            CancellationToken.None);

        Assert.Equal(literal, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task PageBeyondTheIntegerOffset_ReturnsAnEmptyPageAndKeepsTheTotal()
    {
        var token = NewToken();
        for (var index = 0; index < 5; index++)
        {
            await StoreHotelAsync($"{token} Hotel {index}");
        }

        var page = await ListAsync(token, page: 42949674, pageSize: 100);

        Assert.Empty(page.Items);
        Assert.Equal(5, page.TotalItems);
    }

    [Fact]
    public async Task MinimumRating_KeepsHotelsAtOrAboveTheValueAndExcludesLowerOnes()
    {
        var token = NewToken();
        var above = await StoreHotelAsync($"{token} Above");
        var exact = await StoreHotelAsync($"{token} Exact");
        var below = await StoreHotelAsync($"{token} Below");
        await RateAsync(above, 5m);
        await RateAsync(exact, 4m);
        await RateAsync(below, 3.9m);

        var page = await ListAsync(token, minimumRating: 4m);

        Assert.Equal(2, page.TotalItems);
        Assert.Contains(page.Items, item => item.Id == above);
        Assert.Contains(page.Items, item => item.Id == exact);
        Assert.DoesNotContain(page.Items, item => item.Id == below);
    }

    [Fact]
    public async Task MinimumRating_UsesTheAverageOfAllRatingsOfTheHotel()
    {
        var token = NewToken();
        var mixed = await StoreHotelAsync($"{token} Mixed");
        await RateAsync(mixed, 5m);
        await RateAsync(mixed, 1m);

        Assert.Empty((await ListAsync(token, minimumRating: 3.5m)).Items);
        Assert.Single((await ListAsync(token, minimumRating: 3m)).Items);
    }

    [Fact]
    public async Task HotelWithoutRatings_IsExcludedByMinimumRatingOfOneAndIncludedWithoutFilter()
    {
        var token = NewToken();
        var hotelId = await StoreHotelAsync($"{token} Unrated");

        var filtered = await ListAsync(token, minimumRating: 1m);
        var unfiltered = await ListAsync(token);

        Assert.Empty(filtered.Items);
        Assert.Equal(0, filtered.TotalItems);
        Assert.Equal(hotelId, Assert.Single(unfiltered.Items).Id);
    }

    [Fact]
    public async Task Pagination_ReturnsTheRequestedPageSizeTotalItemsAndTotalPages()
    {
        var token = NewToken();
        for (var index = 0; index < 5; index++)
        {
            await StoreHotelAsync($"{token} {index}", CreatedAt.AddMinutes(index));
        }

        var first = await ListAsync(token, page: 1, pageSize: 2);
        var last = await ListAsync(token, page: 3, pageSize: 2);
        var beyond = await ListAsync(token, page: 4, pageSize: 2);

        Assert.Equal(2, first.Items.Count);
        Assert.Equal(5, first.TotalItems);
        Assert.Equal(3, first.TotalPages);
        Assert.Equal(1, first.Page);
        Assert.Equal(2, first.PageSize);
        Assert.Single(last.Items);
        Assert.Empty(beyond.Items);
        Assert.Equal(5, beyond.TotalItems);
    }

    [Fact]
    public async Task Ordering_IsByCreationTimeAcrossPagesWithTheIdentifierAsTieBreaker()
    {
        var token = NewToken();
        var late = await StoreHotelAsync($"{token} Late", CreatedAt.AddHours(2));
        var early = await StoreHotelAsync($"{token} Early", CreatedAt);
        var tiedA = await StoreHotelAsync($"{token} Tied A", CreatedAt.AddHours(1));
        var tiedB = await StoreHotelAsync($"{token} Tied B", CreatedAt.AddHours(1));
        var tied = new[] { tiedA, tiedB }.Order().ToArray();

        var firstPage = await ListAsync(token, page: 1, pageSize: 2);
        var secondPage = await ListAsync(token, page: 2, pageSize: 2);

        var ordered = firstPage.Items.Concat(secondPage.Items).Select(item => item.Id).ToArray();
        Assert.Equal([early, tied[0], tied[1], late], ordered);
    }

    [Fact]
    public async Task ReturnedHotel_CarriesTheMeanOfTwoUsersRatings()
    {
        var token = NewToken();
        var hotelId = await StoreHotelAsync($"{token} Rated");
        await database.CreateRatingStore().RateAsync(hotelId, Guid.NewGuid(), 5m, CancellationToken.None);
        await database.CreateRatingStore().RateAsync(hotelId, Guid.NewGuid(), 2m, CancellationToken.None);

        var item = Assert.Single((await ListAsync(token)).Items);

        Assert.Equal(2, item.Rating.Count);
        Assert.Equal(7m, item.Rating.Sum);
        Assert.Equal(3.5m, item.Rating.Average);
    }

    [Fact]
    public async Task ReturnedHotelWithoutRatings_HasNullAverageAndZeroCount()
    {
        var token = NewToken();
        await StoreHotelAsync($"{token} Unrated");

        var item = Assert.Single((await ListAsync(token)).Items);

        Assert.Equal(0, item.Rating.Count);
        Assert.Equal(0m, item.Rating.Sum);
        Assert.Null(item.Rating.Average);
    }

    [Fact]
    public async Task ReturnedHotel_CarriesTheStoredHotelData()
    {
        var token = NewToken();
        var hotel = Hotel.Create(
            new HotelDetails(
                $"{token} Full",
                "Seafront hotel",
                new HotelAddress("1 Beach Road", "Cartagena", "Bolivar", "Colombia", "130001"),
                new HotelContact("+57 5 555 0100", "frontdesk@example.com", "https://hotel.example.com")),
            CreatedAt);
        await database.CreateStore().AddAsync(hotel, CancellationToken.None);

        var item = Assert.Single((await ListAsync(token)).Items);

        Assert.Equal(hotel.Id, item.Id);
        Assert.Equal(hotel.Details.Description, item.Description);
        Assert.Equal(hotel.Details.Address, item.Address);
        Assert.Equal(hotel.Details.Contact, item.Contact);
        Assert.True(item.IsActive);
        Assert.Equal(CreatedAt, item.CreatedAtUtc);
        Assert.Equal(DateTimeKind.Utc, item.CreatedAtUtc.Kind);
    }
}
