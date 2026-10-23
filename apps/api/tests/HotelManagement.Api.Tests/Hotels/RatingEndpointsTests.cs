using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Npgsql;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class RatingEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private HotelApiFactory? factory;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient firstUser = null!;
    private HttpClient secondUser = null!;
    private Guid firstUserId;
    private Guid secondUserId;

    private string Marker { get; } = Guid.CreateVersion7().ToString("N");

    public async Task InitializeAsync()
    {
        factory = new HotelApiFactory(api.ConnectionString, AdministratorEmail, AdministratorPassword);
        anonymous = factory.CreateClient();
        administrator = factory.CreateClient();
        firstUser = factory.CreateClient();
        secondUser = factory.CreateClient();

        var administratorToken = await SignInAsync(AdministratorEmail, AdministratorPassword);
        administrator.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administratorToken.AccessToken);

        firstUserId = await RegisterAndAuthorizeAsync(firstUser);
        secondUserId = await RegisterAndAuthorizeAsync(secondUser);
    }

    public async Task DisposeAsync()
    {
        anonymous.Dispose();
        administrator.Dispose();
        firstUser.Dispose();
        secondUser.Dispose();
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }
    }

    [Fact]
    public async Task Rate_AsAUser_ReturnsTheSummaryAndStoresTheVoteForThatAccount()
    {
        var hotelId = await CreateHotelAsync();

        var response = await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 4.5m });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await ReadSummaryAsync(response);
        Assert.Equal(4.5m, summary.Sum);
        Assert.Equal(1, summary.Count);
        Assert.Equal(4.5m, summary.Average);
        Assert.Equal(4.5m, await StoredScoreAsync(hotelId, firstUserId));
        Assert.Equal(1, await CountVotesAsync(hotelId));
        Assert.Equal(1, (await ReadHotelRatingAsync(hotelId)).Count);
    }

    [Fact]
    public async Task Rate_AsAnAdministrator_IsAccepted()
    {
        var hotelId = await CreateHotelAsync();

        var response = await administrator.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 3m });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(1, await CountVotesAsync(hotelId));
    }

    [Fact]
    public async Task Rate_TwiceBySameUser_UpdatesTheVoteAndKeepsTheCountAtOne()
    {
        var hotelId = await CreateHotelAsync();
        await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 2m });

        var response = await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 5m });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var summary = await ReadSummaryAsync(response);
        Assert.Equal(1, summary.Count);
        Assert.Equal(5m, summary.Sum);
        Assert.Equal(5m, summary.Average);
        Assert.Equal(1, await CountVotesAsync(hotelId));
        Assert.Equal(5m, await StoredScoreAsync(hotelId, firstUserId));
        var stored = await ReadHotelRatingAsync(hotelId);
        Assert.Equal(1, stored.Count);
        Assert.Equal(5m, stored.Average);
    }

    [Fact]
    public async Task Rate_ByTwoAccounts_CountsTwoVotesAndAttributesEachToItsOwnAccount()
    {
        var hotelId = await CreateHotelAsync();

        await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 2m });
        var response = await secondUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 5m });

        var summary = await ReadSummaryAsync(response);
        Assert.Equal(2, summary.Count);
        Assert.Equal(7m, summary.Sum);
        Assert.Equal(3.5m, summary.Average);
        Assert.Equal(2, await CountVotesAsync(hotelId));
        Assert.Equal(2m, await StoredScoreAsync(hotelId, firstUserId));
        Assert.Equal(5m, await StoredScoreAsync(hotelId, secondUserId));
        var stored = await ReadHotelRatingAsync(hotelId);
        Assert.Equal(2, stored.Count);
        Assert.Equal(3.5m, stored.Average);
    }

    [Fact]
    public async Task Rate_IgnoresAUserIdentifierInTheBodyAndUsesTheTokenSubject()
    {
        var hotelId = await CreateHotelAsync();

        var response = await firstUser.PostAsJsonAsync(
            $"/api/hotels/{hotelId}/ratings",
            new { score = 4m, userId = secondUserId });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(4m, await StoredScoreAsync(hotelId, firstUserId));
        Assert.Null(await StoredScoreAsync(hotelId, secondUserId));
        Assert.Equal(1, await CountVotesAsync(hotelId));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(6)]
    [InlineData(-1)]
    public async Task Rate_WithAScoreOutsideTheRange_ReturnsBadRequestWithTheScoreFieldAndStoresNothing(int score)
    {
        var hotelId = await CreateHotelAsync();

        var response = await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemView>(Json);
        Assert.Contains("score", problem!.Errors.Keys);
        Assert.False(string.IsNullOrWhiteSpace(problem.Errors["score"][0]));
        Assert.Equal(0, await CountVotesAsync(hotelId));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    public async Task Rate_WithABoundaryScore_IsAccepted(int score)
    {
        var hotelId = await CreateHotelAsync();

        var response = await firstUser.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(score, await StoredScoreAsync(hotelId, firstUserId));
        Assert.Equal(score, (await ReadSummaryAsync(response)).Average);
    }

    [Fact]
    public async Task Rate_AHotelThatDoesNotExist_ReturnsNotFoundAndStoresNothing()
    {
        var missing = Guid.CreateVersion7();

        var response = await firstUser.PostAsJsonAsync($"/api/hotels/{missing}/ratings", new { score = 3m });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<TitleView>(Json);
        Assert.Equal("The hotel does not exist.", problem!.Title);
        Assert.Equal(0, await CountVotesAsync(missing));
    }

    [Fact]
    public async Task Rate_WithoutAToken_ReturnsUnauthorizedAndStoresNothing()
    {
        var hotelId = await CreateHotelAsync();

        var response = await anonymous.PostAsJsonAsync($"/api/hotels/{hotelId}/ratings", new { score = 3m });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, await CountVotesAsync(hotelId));
    }

    private async Task<Guid> RegisterAndAuthorizeAsync(HttpClient client)
    {
        var email = $"{Guid.CreateVersion7()}@example.com";
        var registration = await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = UserPassword });
        Assert.True(registration.IsSuccessStatusCode);
        var token = await SignInAsync(email, UserPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        return token.UserId;
    }

    private async Task<Guid> CreateHotelAsync()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", new { name = $"Rated {Marker}" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelView>(Json))!.Id;
    }

    private async Task<RatingView> ReadHotelRatingAsync(Guid hotelId)
    {
        var response = await administrator.GetAsync($"/api/hotels/{hotelId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelView>(Json))!.Rating;
    }

    private static async Task<RatingView> ReadSummaryAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<RatingView>(Json))!;

    private async Task<int> CountVotesAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT count(*) FROM hotel_ratings WHERE hotel_id = @hotel", connection);
        command.Parameters.AddWithValue("hotel", hotelId);
        return Convert.ToInt32(await command.ExecuteScalarAsync() ?? 0);
    }

    private async Task<decimal?> StoredScoreAsync(Guid hotelId, Guid accountId)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT score FROM hotel_ratings WHERE hotel_id = @hotel AND user_id = @account",
            connection);
        command.Parameters.AddWithValue("hotel", hotelId);
        command.Parameters.AddWithValue("account", accountId);
        var value = await command.ExecuteScalarAsync();
        return value is null or DBNull ? null : Convert.ToDecimal(value);
    }

    private async Task<SignInView> SignInAsync(string email, string password)
    {
        var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SignInView>(Json))!;
    }

    private sealed record RatingView(decimal Sum, int Count, decimal? Average);

    private sealed record HotelView(Guid Id, RatingView Rating);

    private sealed record ProblemView(Dictionary<string, string[]> Errors);

    private sealed record TitleView(string Title);

    private sealed record SignInView(string AccessToken, Guid UserId);
}
