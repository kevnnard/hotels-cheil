using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Tests.Hotels;

public class HotelServiceTests
{
    private static readonly DateTime Now = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime Earlier = new(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);

    private readonly FakeHotelStore hotels = new();
    private readonly FakeHotelRatingsStore ratings = new();
    private readonly FixedTimeProvider clock = new(Now);

    private HotelService Service => new(hotels, ratings, clock);

    private static HotelDetailsInput ValidInput(string? name = "Grand Plaza") => new(
        name,
        "Seafront hotel",
        "1 Main Street",
        "Lisbon",
        "Lisboa",
        "Portugal",
        "1000-001",
        "+351123456789",
        "info@grandplaza.test",
        "https://grandplaza.test");

    private Hotel SeedHotel()
    {
        var hotel = Hotel.Create(new HotelDetails("Old Name", "Old description"), Earlier);
        hotels.Seed(hotel);
        return hotel;
    }

    [Fact]
    public async Task Create_with_valid_name_stores_hotel_and_returns_its_id()
    {
        var outcome = await Service.CreateAsync(new CreateHotel(ValidInput()), CancellationToken.None);

        var stored = Assert.Single(hotels.Added);
        Assert.Equal(CreateHotelStatus.Created, outcome.Status);
        Assert.Equal(stored.Id, outcome.HotelId);
        Assert.NotEqual(Guid.Empty, outcome.HotelId);
        Assert.Equal("Grand Plaza", stored.Details.Name);
        Assert.Equal("Seafront hotel", stored.Details.Description);
        Assert.Equal("1 Main Street", stored.Details.Address.Street);
        Assert.Equal("Lisbon", stored.Details.Address.City);
        Assert.Equal("Lisboa", stored.Details.Address.Region);
        Assert.Equal("Portugal", stored.Details.Address.Country);
        Assert.Equal("1000-001", stored.Details.Address.PostalCode);
        Assert.Equal("+351123456789", stored.Details.Contact.Phone);
        Assert.Equal("info@grandplaza.test", stored.Details.Contact.Email);
        Assert.Equal("https://grandplaza.test", stored.Details.Contact.Website);
        Assert.Equal(Now, stored.CreatedAtUtc);
        Assert.Equal(Now, stored.UpdatedAtUtc);
        Assert.True(stored.IsActive);
        Assert.Null(outcome.InvalidField);
        Assert.Null(outcome.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Create_with_missing_name_reports_name_field_and_persists_nothing(string? name)
    {
        var outcome = await Service.CreateAsync(new CreateHotel(ValidInput(name)), CancellationToken.None);

        Assert.Equal(CreateHotelStatus.InvalidInput, outcome.Status);
        Assert.Equal("name", outcome.InvalidField);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
        Assert.Equal(Guid.Empty, outcome.HotelId);
        Assert.Empty(hotels.Added);
    }

    [Fact]
    public async Task Create_with_invalid_contact_email_reports_message_without_field_and_persists_nothing()
    {
        var input = ValidInput() with { Email = "not-an-email" };

        var outcome = await Service.CreateAsync(new CreateHotel(input), CancellationToken.None);

        Assert.Equal(CreateHotelStatus.InvalidInput, outcome.Status);
        Assert.Null(outcome.InvalidField);
        Assert.Equal("Email is not valid.", outcome.Message);
        Assert.Equal(Guid.Empty, outcome.HotelId);
        Assert.Empty(hotels.Added);
    }

    [Fact]
    public async Task List_with_valid_query_reaches_store_with_same_query()
    {
        var query = new HotelQuery { Name = "plaza", MinimumRating = 3.5m, Page = 2, PageSize = 10 };
        var page = new HotelPage([], 2, 10, 0);
        hotels.PageToReturn = page;

        var outcome = await Service.ListAsync(query, CancellationToken.None);

        Assert.Equal(ListHotelsStatus.Listed, outcome.Status);
        Assert.Equal(page, outcome.Page);
        Assert.Null(outcome.Message);
        Assert.Equal(query, Assert.Single(hotels.ListedQueries));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(HotelQuery.MaximumPageSize + 1)]
    public async Task List_with_invalid_page_size_is_rejected_without_calling_store(int pageSize)
    {
        var outcome = await Service.ListAsync(new HotelQuery { PageSize = pageSize }, CancellationToken.None);

        Assert.Equal(ListHotelsStatus.InvalidQuery, outcome.Status);
        Assert.Null(outcome.Page);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
        Assert.Empty(hotels.ListedQueries);
    }

    [Theory]
    [InlineData(0.5)]
    [InlineData(5.1)]
    public async Task List_with_invalid_minimum_rating_is_rejected_without_calling_store(double minimumRating)
    {
        var query = new HotelQuery { MinimumRating = (decimal)minimumRating };

        var outcome = await Service.ListAsync(query, CancellationToken.None);

        Assert.Equal(ListHotelsStatus.InvalidQuery, outcome.Status);
        Assert.Null(outcome.Page);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
        Assert.Empty(hotels.ListedQueries);
    }

    [Fact]
    public async Task Find_existing_hotel_with_ratings_returns_summary_with_average_and_count()
    {
        var hotel = SeedHotel();
        ratings.Seed(hotel.Id, RatingSummary.From(9m, 2));

        var summary = await Service.FindAsync(hotel.Id, CancellationToken.None);

        Assert.NotNull(summary);
        Assert.Equal(hotel.Id, summary.Id);
        Assert.Equal("Old Name", summary.Name);
        Assert.Equal("Old description", summary.Description);
        Assert.Equal(hotel.Details.Address, summary.Address);
        Assert.Equal(hotel.Details.Contact, summary.Contact);
        Assert.True(summary.IsActive);
        Assert.Equal(Earlier, summary.CreatedAtUtc);
        Assert.Equal(Earlier, summary.UpdatedAtUtc);
        Assert.Equal(4.5m, summary.Rating.Average);
        Assert.Equal(2, summary.Rating.Count);
    }

    [Fact]
    public async Task Find_existing_hotel_without_ratings_returns_null_average_and_zero_count()
    {
        var hotel = SeedHotel();

        var summary = await Service.FindAsync(hotel.Id, CancellationToken.None);

        Assert.NotNull(summary);
        Assert.Equal(hotel.Id, summary.Id);
        Assert.Null(summary.Rating.Average);
        Assert.Equal(0, summary.Rating.Count);
        Assert.Equal(1, ratings.SummaryLookups);
    }

    [Fact]
    public async Task Find_missing_hotel_returns_null_without_loading_ratings()
    {
        var summary = await Service.FindAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.Null(summary);
        Assert.Equal(0, ratings.SummaryLookups);
    }

    [Fact]
    public async Task Update_existing_hotel_persists_new_details_and_returns_summary()
    {
        var hotel = SeedHotel();
        ratings.Seed(hotel.Id, RatingSummary.From(8m, 2));

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(ValidInput("Renamed")), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.Updated, outcome.Status);
        Assert.NotNull(outcome.Hotel);
        Assert.Equal(hotel.Id, outcome.Hotel.Id);
        Assert.Equal("Renamed", outcome.Hotel.Name);
        Assert.Equal("Lisbon", outcome.Hotel.Address.City);
        Assert.Equal(Earlier, outcome.Hotel.CreatedAtUtc);
        Assert.Equal(Now, outcome.Hotel.UpdatedAtUtc);
        Assert.Equal(4m, outcome.Hotel.Rating.Average);
        Assert.Equal(2, outcome.Hotel.Rating.Count);
        var persisted = Assert.Single(hotels.Updated);
        Assert.Equal(hotel.Id, persisted.Id);
        Assert.Equal("Renamed", persisted.Details.Name);
        Assert.Equal(Now, persisted.UpdatedAtUtc);
    }

    [Fact]
    public async Task Update_missing_hotel_returns_not_found_and_persists_nothing()
    {
        var outcome = await Service.UpdateAsync(Guid.NewGuid(), new UpdateHotel(ValidInput()), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.NotFound, outcome.Status);
        Assert.Null(outcome.Hotel);
        Assert.Empty(hotels.Updated);
    }

    [Fact]
    public async Task Update_when_the_hotel_disappears_before_the_write_returns_not_found()
    {
        var hotel = SeedHotel();
        hotels.UpdateResult = false;

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(ValidInput("Renamed")), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.NotFound, outcome.Status);
        Assert.Null(outcome.Hotel);
    }

    [Fact]
    public async Task Update_with_invalid_name_reports_name_field_and_keeps_stored_hotel_unchanged()
    {
        var hotel = SeedHotel();

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(ValidInput(" ")), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.InvalidInput, outcome.Status);
        Assert.Equal("name", outcome.InvalidField);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
        Assert.Null(outcome.Hotel);
        Assert.Empty(hotels.Updated);
        Assert.Equal("Old Name", hotel.Details.Name);
        Assert.Equal(Earlier, hotel.UpdatedAtUtc);
    }

    [Fact]
    public async Task Update_with_invalid_email_reports_message_without_field_and_persists_nothing()
    {
        var hotel = SeedHotel();
        var input = ValidInput() with { Email = "broken" };

        var outcome = await Service.UpdateAsync(hotel.Id, new UpdateHotel(input), CancellationToken.None);

        Assert.Equal(UpdateHotelStatus.InvalidInput, outcome.Status);
        Assert.Null(outcome.InvalidField);
        Assert.Equal("Email is not valid.", outcome.Message);
        Assert.Empty(hotels.Updated);
        Assert.Equal("Old Name", hotel.Details.Name);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Delete_returns_store_result_for_the_requested_hotel(bool storeResult)
    {
        var hotelId = Guid.NewGuid();
        hotels.DeleteResult = storeResult;

        var deleted = await Service.DeleteAsync(hotelId, CancellationToken.None);

        Assert.Equal(storeResult, deleted);
        Assert.Equal(hotelId, Assert.Single(hotels.Deleted));
    }

    [Fact]
    public async Task Rate_existing_hotel_passes_caller_user_and_score_and_returns_summary()
    {
        var hotel = SeedHotel();
        var userId = Guid.NewGuid();
        ratings.RateResult = RatingSummary.From(7m, 2);

        var outcome = await Service.RateAsync(hotel.Id, userId, 3.5m, CancellationToken.None);

        Assert.Equal(RateHotelStatus.Rated, outcome.Status);
        Assert.NotNull(outcome.Rating);
        Assert.Equal(3.5m, outcome.Rating.Average);
        Assert.Equal(2, outcome.Rating.Count);
        Assert.Null(outcome.InvalidField);
        var call = Assert.Single(ratings.Rated);
        Assert.Equal((hotel.Id, userId, 3.5m), call);
    }

    [Theory]
    [InlineData(0.99)]
    [InlineData(0)]
    [InlineData(5.01)]
    [InlineData(6)]
    public async Task Rate_with_score_out_of_range_is_rejected_and_nothing_is_stored(double score)
    {
        var hotel = SeedHotel();

        var outcome = await Service.RateAsync(hotel.Id, Guid.NewGuid(), (decimal)score, CancellationToken.None);

        Assert.Equal(RateHotelStatus.InvalidInput, outcome.Status);
        Assert.Equal("score", outcome.InvalidField);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
        Assert.Null(outcome.Rating);
        Assert.Empty(ratings.Rated);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task Rate_with_boundary_score_is_accepted(double score)
    {
        var hotel = SeedHotel();
        var userId = Guid.NewGuid();
        ratings.RateResult = RatingSummary.From((decimal)score, 1);

        var outcome = await Service.RateAsync(hotel.Id, userId, (decimal)score, CancellationToken.None);

        Assert.Equal(RateHotelStatus.Rated, outcome.Status);
        Assert.Equal((decimal)score, outcome.Rating?.Average);
        Assert.Equal(1, outcome.Rating?.Count);
        Assert.Equal((hotel.Id, userId, (decimal)score), Assert.Single(ratings.Rated));
    }

    [Fact]
    public async Task Rate_missing_hotel_returns_not_found_and_nothing_is_stored()
    {
        var outcome = await Service.RateAsync(Guid.NewGuid(), Guid.NewGuid(), 4m, CancellationToken.None);

        Assert.Equal(RateHotelStatus.HotelNotFound, outcome.Status);
        Assert.Null(outcome.Rating);
        Assert.Empty(ratings.Rated);
    }

    [Fact]
    public async Task Rate_when_the_hotel_disappears_before_the_vote_returns_not_found()
    {
        var hotel = SeedHotel();
        ratings.RateResult = null;

        var outcome = await Service.RateAsync(hotel.Id, Guid.NewGuid(), 4m, CancellationToken.None);

        Assert.Equal(RateHotelStatus.HotelNotFound, outcome.Status);
        Assert.Null(outcome.Rating);
        Assert.Single(ratings.Rated);
    }
}
