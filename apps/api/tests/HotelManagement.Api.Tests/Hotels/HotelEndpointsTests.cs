using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Api.Tests.Authentication;
using HotelManagement.Application.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class HotelEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private HotelApiFactory? factory;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient user = null!;
    private Guid userId;
    private string userToken = null!;

    private string Marker { get; } = Guid.CreateVersion7().ToString("N");

    public async Task InitializeAsync()
    {
        factory = new HotelApiFactory(api.ConnectionString, AdministratorEmail, AdministratorPassword);
        anonymous = factory.CreateClient();
        administrator = factory.CreateClient();
        user = factory.CreateClient();

        var administratorToken = await SignInAsync(anonymous, AdministratorEmail, AdministratorPassword);
        administrator.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administratorToken.AccessToken);

        var email = $"{Guid.CreateVersion7()}@example.com";
        await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = UserPassword });
        var userToken = await SignInAsync(anonymous, email, UserPassword);
        userId = userToken.UserId;
        this.userToken = userToken.AccessToken;
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userToken.AccessToken);
    }

    public async Task DisposeAsync()
    {
        anonymous.Dispose();
        administrator.Dispose();
        user.Dispose();
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }
    }

    [Fact]
    public async Task Create_WithAnAdministrator_ReturnsCreatedWithTheHotelAndALocation()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", Body($"Grand {Marker}"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await ReadHotelAsync(response);
        Assert.NotEqual(Guid.Empty, created.Id);
        Assert.Equal($"Grand {Marker}", created.Name);
        Assert.Equal("Lisbon", created.Address.City);
        Assert.Equal("front@example.com", created.Contact.Email);
        Assert.True(created.IsActive);
        Assert.Equal(0, created.Rating.Count);
        Assert.Null(created.Rating.Average);
        Assert.EndsWith($"/api/hotels/{created.Id}", response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Create_WithAUser_ReturnsForbiddenWithoutABodyAndStoresNothing()
    {
        var name = $"Denied {Marker}";

        var response = await user.PostAsJsonAsync("/api/hotels", Body(name));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        Assert.Equal(0, await CountHotelsAsync(name));
    }

    [Fact]
    public async Task Create_WithoutAToken_ReturnsUnauthorizedAndStoresNothing()
    {
        var name = $"Anonymous {Marker}";

        var response = await anonymous.PostAsJsonAsync("/api/hotels", Body(name));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, await CountHotelsAsync(name));
    }

    [Fact]
    public async Task List_WithAPageBeyondTheIntegerOffset_ReturnsAnEmptyPageAndKeepsTheTotal()
    {
        for (var index = 0; index < 5; index++)
        {
            await CreateHotelAsync($"Overflow {Marker} {index}");
        }

        var firstPage = await ReadPageAsync(await administrator.GetAsync("/api/hotels?page=1&pageSize=100"));
        var response = await administrator.GetAsync("/api/hotels?page=42949674&pageSize=100");

        var page = await ReadPageAsync(response);
        Assert.Empty(page.Items);
        Assert.Equal(firstPage.TotalItems, page.TotalItems);
        Assert.Equal(42949674, page.Page);
        Assert.Equal(100, page.PageSize);
    }

    [Fact]
    public async Task List_WithoutAToken_ReturnsUnauthorized()
    {
        var response = await anonymous.GetAsync("/api/hotels");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task List_WithAPrincipalWithoutTheHotelRoles_ReturnsForbidden()
    {
        using var client = factory!.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestPrincipals.TokenWithoutHotelRoles(userToken));

        var response = await client.GetAsync("/api/hotels");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Create_WithAMissingName_ReturnsBadRequestWithTheNameField()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", Body(null));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadProblemAsync(response);
        Assert.Contains("name", problem.Errors.Keys, StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Get_WithAnAdministratorAndWithAUser_ReturnsTheHotel()
    {
        var created = await CreateHotelAsync($"Readable {Marker}");

        var asAdministrator = await administrator.GetAsync($"/api/hotels/{created.Id}");
        var asUser = await user.GetAsync($"/api/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.OK, asAdministrator.StatusCode);
        Assert.Equal(HttpStatusCode.OK, asUser.StatusCode);
        Assert.Equal(created.Id, (await ReadHotelAsync(asAdministrator)).Id);
        Assert.Equal($"Readable {Marker}", (await ReadHotelAsync(asUser)).Name);
    }

    [Fact]
    public async Task Get_WithoutAToken_ReturnsUnauthorized()
    {
        var created = await CreateHotelAsync($"Guarded {Marker}");

        var response = await anonymous.GetAsync($"/api/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Get_OfAHotelThatDoesNotExist_ReturnsNotFound()
    {
        var response = await administrator.GetAsync($"/api/hotels/{Guid.CreateVersion7()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task List_WithAnAdministratorAndWithAUser_ReturnsTheHotels()
    {
        await CreateHotelAsync($"Listed {Marker}");

        var asAdministrator = await administrator.GetAsync($"/api/hotels?name={Marker}");
        var asUser = await user.GetAsync($"/api/hotels?name={Marker}");

        Assert.Equal(HttpStatusCode.OK, asAdministrator.StatusCode);
        Assert.Equal(HttpStatusCode.OK, asUser.StatusCode);
        Assert.Single((await ReadPageAsync(asAdministrator)).Items);
        Assert.Single((await ReadPageAsync(asUser)).Items);
    }

    [Fact]
    public async Task List_WithANameFilter_KeepsTheMatchingHotelAndExcludesTheOther()
    {
        await CreateHotelAsync($"Seaside {Marker}");
        await CreateHotelAsync($"Mountain {Marker}");

        var page = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name=SEASIDE%20{Marker}"));

        var item = Assert.Single(page.Items);
        Assert.Equal($"Seaside {Marker}", item.Name);
        Assert.Equal(1, page.TotalItems);
    }

    [Fact]
    public async Task List_WithAMinimumRating_KeepsOnlyTheHotelsAtOrAboveIt()
    {
        var high = await CreateHotelAsync($"High {Marker}");
        var low = await CreateHotelAsync($"Low {Marker}");
        var unrated = await CreateHotelAsync($"Unrated {Marker}");
        await RateAsync(high.Id, 5m);
        await RateAsync(low.Id, 2m);

        var page = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&minRating=4"));

        var item = Assert.Single(page.Items);
        Assert.Equal(high.Id, item.Id);
        Assert.Equal(5m, item.Rating.Average);
        Assert.DoesNotContain(page.Items, hotel => hotel.Id == low.Id || hotel.Id == unrated.Id);
    }

    [Fact]
    public async Task List_WithAPageSizeAndAPage_ReturnsTheExpectedItemsAndTotals()
    {
        for (var index = 1; index <= 5; index++)
        {
            await CreateHotelAsync($"Paged {index} {Marker}");
        }

        var first = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&page=1&pageSize=2"));
        var last = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&page=3&pageSize=2"));

        Assert.Equal(new[] { $"Paged 1 {Marker}", $"Paged 2 {Marker}" }, first.Items.Select(item => item.Name));
        Assert.Equal(1, first.Page);
        Assert.Equal(2, first.PageSize);
        Assert.Equal(5, first.TotalItems);
        Assert.Equal(3, first.TotalPages);
        Assert.Equal(new[] { $"Paged 5 {Marker}" }, last.Items.Select(item => item.Name));
        Assert.Equal(3, last.Page);
    }

    [Theory]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    [InlineData("page=0")]
    [InlineData("minRating=6")]
    public async Task List_WithAnInvalidQuery_ReturnsBadRequest(string query)
    {
        var response = await administrator.GetAsync($"/api/hotels?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Update_WithAnAdministrator_ReturnsTheUpdatedHotel()
    {
        var created = await CreateHotelAsync($"Before {Marker}");

        var response = await administrator.PutAsJsonAsync($"/api/hotels/{created.Id}", Body($"After {Marker}", "Porto"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await ReadHotelAsync(response);
        Assert.Equal(created.Id, updated.Id);
        Assert.Equal($"After {Marker}", updated.Name);
        Assert.Equal("Porto", updated.Address.City);
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));
        Assert.Equal($"After {Marker}", stored.Name);
    }

    [Fact]
    public async Task Update_WithAUser_ReturnsForbiddenWithoutABodyAndKeepsTheStoredValues()
    {
        var created = await CreateHotelAsync($"Kept {Marker}");
        await RateAsync(created.Id, 3m);
        var before = await SnapshotAsync(created.Id);
        var expected = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));

        var response = await user.PutAsJsonAsync($"/api/hotels/{created.Id}", Body($"Changed {Marker}", "Porto"));

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        Assert.Equal(before, await SnapshotAsync(created.Id));
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));
        Assert.Equal(expected, stored);
    }

    [Fact]
    public async Task Update_WithoutAToken_ReturnsUnauthorizedAndKeepsTheStoredValues()
    {
        var created = await CreateHotelAsync($"Untouched {Marker}");
        await RateAsync(created.Id, 3m);
        var before = await SnapshotAsync(created.Id);

        var response = await anonymous.PutAsJsonAsync($"/api/hotels/{created.Id}", Body($"Changed {Marker}", "Porto"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(before, await SnapshotAsync(created.Id));
    }

    [Fact]
    public async Task Update_WithAnInvalidContactEmail_ReturnsBadRequestAndKeepsTheStoredValues()
    {
        var created = await CreateHotelAsync($"Stable {Marker}");
        var body = Body($"Stable {Marker}") with { Email = "not-an-email" };

        var response = await administrator.PutAsJsonAsync($"/api/hotels/{created.Id}", body);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));
        Assert.Equal(created, stored);
    }

    [Fact]
    public async Task Update_OfAHotelThatDoesNotExist_ReturnsNotFound()
    {
        var response = await administrator.PutAsJsonAsync($"/api/hotels/{Guid.CreateVersion7()}", Body($"Ghost {Marker}"));

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(0, await CountHotelsAsync($"Ghost {Marker}"));
    }

    [Fact]
    public async Task Delete_WithAnAdministrator_ReturnsNoContentAndRemovesTheHotel()
    {
        var created = await CreateHotelAsync($"Doomed {Marker}");

        var response = await administrator.DeleteAsync($"/api/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync($"/api/hotels/{created.Id}")).StatusCode);
        Assert.Equal(0, await CountHotelsAsync($"Doomed {Marker}"));
    }

    [Fact]
    public async Task Delete_WithAUser_ReturnsForbiddenWithoutABodyAndKeepsTheHotel()
    {
        var created = await CreateHotelAsync($"Survivor {Marker}");
        await RateAsync(created.Id, 3m);
        var before = await SnapshotAsync(created.Id);
        var expected = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));

        var response = await user.DeleteAsync($"/api/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Empty(await response.Content.ReadAsStringAsync());
        Assert.Equal(before, await SnapshotAsync(created.Id));
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{created.Id}"));
        Assert.Equal(expected, stored);
        Assert.Equal(1, await CountHotelsAsync($"Survivor {Marker}"));
    }

    [Fact]
    public async Task Delete_WithoutAToken_ReturnsUnauthorizedAndKeepsTheHotel()
    {
        var created = await CreateHotelAsync($"Kept {Marker}");
        await RateAsync(created.Id, 3m);
        var before = await SnapshotAsync(created.Id);

        var response = await anonymous.DeleteAsync($"/api/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(before, await SnapshotAsync(created.Id));
    }

    [Fact]
    public async Task Delete_OfAHotelThatDoesNotExist_ReturnsNotFound()
    {
        var response = await administrator.DeleteAsync($"/api/hotels/{Guid.CreateVersion7()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static HotelBody Body(string? name, string city = "Lisbon") => new(
        name,
        "A quiet hotel",
        "1 Main Street",
        city,
        "Lisbon District",
        "Portugal",
        "1000-001",
        "+351210000000",
        "front@example.com",
        "https://hotel.example.com");

    private async Task<HotelView> CreateHotelAsync(string name)
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", Body(name));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadHotelAsync(response);
    }

    private async Task RateAsync(Guid hotelId, decimal score)
    {
        using var scope = factory!.Services.CreateScope();
        var ratings = scope.ServiceProvider.GetRequiredService<IHotelRatingsStore>();
        await ratings.RateAsync(hotelId, userId, score, CancellationToken.None);
    }

    private async Task<int> CountHotelsAsync(string name)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT count(*) FROM hotels WHERE name = @name", connection);
        command.Parameters.AddWithValue("name", name);
        return Convert.ToInt32(await command.ExecuteScalarAsync() ?? 0);
    }

    private async Task<(string Hotel, string Ratings)> SnapshotAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();

        await using var hotelCommand = new NpgsqlCommand(
            "SELECT coalesce(to_jsonb(h), 'null'::jsonb)::text FROM hotels h WHERE h.id = @id",
            connection);
        hotelCommand.Parameters.AddWithValue("id", hotelId);
        var hotel = (string?)await hotelCommand.ExecuteScalarAsync() ?? "<missing>";

        await using var ratingCommand = new NpgsqlCommand(
            "SELECT coalesce(json_agg(json_build_object('userId', user_id, 'score', score) ORDER BY user_id), '[]'::json)::text FROM hotel_ratings WHERE hotel_id = @id",
            connection);
        ratingCommand.Parameters.AddWithValue("id", hotelId);
        var ratings = (string?)await ratingCommand.ExecuteScalarAsync() ?? "[]";

        return (hotel, ratings);
    }

    private static async Task<HotelView> ReadHotelAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<HotelView>(Json))!;

    private static async Task<HotelPageView> ReadPageAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelPageView>(Json))!;
    }

    private static async Task<ProblemView> ReadProblemAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ProblemView>(Json))!;

    private static async Task<SignInView> SignInAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SignInView>(Json))!;
    }

    private sealed record HotelBody(
        string? Name,
        string? Description,
        string? Street,
        string? City,
        string? Region,
        string? Country,
        string? PostalCode,
        string? Phone,
        string? Email,
        string? Website);

    private sealed record AddressView(string? Street, string? City, string? Region, string? Country, string? PostalCode);

    private sealed record ContactView(string? Phone, string? Email, string? Website);

    private sealed record RatingView(decimal Sum, int Count, decimal? Average);

    private sealed record HotelView(
        Guid Id,
        string Name,
        string? Description,
        AddressView Address,
        ContactView Contact,
        bool IsActive,
        DateTime CreatedAtUtc,
        DateTime UpdatedAtUtc,
        RatingView Rating);

    private sealed record HotelPageView(IReadOnlyList<HotelView> Items, int Page, int PageSize, int TotalItems, int TotalPages);

    private sealed record ProblemView(Dictionary<string, string[]> Errors);

    private sealed record SignInView(string AccessToken, Guid UserId);
}
