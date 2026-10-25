using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Npgsql;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class HotelPricingEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private HotelApiFactory? factory;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient user = null!;

    private string Marker { get; } = Guid.CreateVersion7().ToString("N");

    public async Task InitializeAsync()
    {
        factory = new HotelApiFactory(api.ConnectionString, AdministratorEmail, AdministratorPassword);
        anonymous = factory.CreateClient();
        administrator = factory.CreateClient();
        user = factory.CreateClient();

        administrator.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", await SignInAsync(AdministratorEmail, AdministratorPassword));

        var email = $"{Guid.CreateVersion7()}@example.com";
        await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = UserPassword });
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", await SignInAsync(email, UserPassword));
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
    public async Task Create_WithPriceAndDiscount_ReturnsTheComputedPricingOnEveryRead()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", new { name = $"Discounted {Marker}", pricePerNight = 199.99m, discountPercent = 15 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await ReadJsonAsync(response);
        AssertPricing(created, 199.99m, 15, 169.99m);
        var id = created.GetProperty("id").GetGuid();

        AssertPricing(await ReadJsonAsync(await administrator.GetAsync($"/api/hotels/{id}")), 199.99m, 15, 169.99m);
        AssertPricing(await ReadJsonAsync(await anonymous.GetAsync($"/api/public/hotels/{id}")), 199.99m, 15, 169.99m);
        AssertPricing(SingleItem(await ReadJsonAsync(await administrator.GetAsync($"/api/hotels?name={Marker}"))), 199.99m, 15, 169.99m);
        AssertPricing(SingleItem(await ReadJsonAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}"))), 199.99m, 15, 169.99m);
    }

    [Fact]
    public async Task Create_WithOnlyAPrice_ReturnsPricingWithoutDiscount()
    {
        var created = await CreateAsync(new { name = $"Plain {Marker}", pricePerNight = 120.5m });

        AssertPricing(created, 120.5m, null, null);
    }

    [Fact]
    public async Task Create_WithoutPricing_ReturnsANullPricingAndKeepsTheOtherFields()
    {
        var created = await CreateAsync(new { name = $"Unpriced {Marker}", city = "Lisbon" });

        Assert.Equal(JsonValueKind.Null, created.GetProperty("pricing").ValueKind);
        Assert.Equal("Lisbon", created.GetProperty("address").GetProperty("city").GetString());
        Assert.Equal(JsonValueKind.Array, created.GetProperty("images").ValueKind);
        Assert.Equal(0, created.GetProperty("rating").GetProperty("count").GetInt32());
    }

    [Theory]
    [InlineData("-1", null, "pricePerNight")]
    [InlineData("0", null, "pricePerNight")]
    [InlineData("100000.01", null, "pricePerNight")]
    [InlineData("10.123", null, "pricePerNight")]
    [InlineData("100", "0", "discountPercent")]
    [InlineData("100", "91", "discountPercent")]
    [InlineData("null", "10", "discountPercent")]
    public async Task Create_WithInvalidPricing_ReturnsBadRequestWithTheFieldAndStoresNothing(string price, string? discount, string field)
    {
        var name = $"Invalid {Marker} {price} {discount}";

        var response = await PostRawAsync(administrator, "/api/hotels", name, price, discount ?? "null");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.True(errors.TryGetProperty(field, out var messages));
        Assert.False(string.IsNullOrWhiteSpace(messages[0].GetString()));
        Assert.Equal(0, await CountHotelsAsync(name));
    }

    [Fact]
    public async Task Create_WithADiscountWithoutAPrice_ExplainsTheRule()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", new { name = $"Orphan {Marker}", discountPercent = 10 });

        var errors = (await ReadJsonAsync(response)).GetProperty("errors");
        Assert.Equal("A discount requires a nightly price.", errors.GetProperty("discountPercent")[0].GetString());
    }

    [Fact]
    public async Task Create_WithAPriceThatIsNotANumber_ReturnsBadRequest()
    {
        var name = $"Text {Marker}";

        var response = await PostRawAsync(administrator, "/api/hotels", name, "\"cheap\"", "null");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await CountHotelsAsync(name));
    }

    [Fact]
    public async Task Update_WithPricing_ReplacesItAndAnUpdateWithoutPricingClearsIt()
    {
        var created = await CreateAsync(new { name = $"Changing {Marker}", pricePerNight = 300m, discountPercent = 10 });
        var id = created.GetProperty("id").GetGuid();

        var repriced = await administrator.PutAsJsonAsync($"/api/hotels/{id}", new { name = $"Changing {Marker}", pricePerNight = 250m, discountPercent = 20 });
        AssertPricing(await ReadJsonAsync(repriced), 250m, 20, 200m);

        var cleared = await administrator.PutAsJsonAsync($"/api/hotels/{id}", new { name = $"Changing {Marker}" });

        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await ReadJsonAsync(cleared)).GetProperty("pricing").ValueKind);
        Assert.Equal(JsonValueKind.Null, (await ReadJsonAsync(await administrator.GetAsync($"/api/hotels/{id}"))).GetProperty("pricing").ValueKind);
    }

    [Fact]
    public async Task Update_WithInvalidPricing_ReturnsBadRequestAndKeepsTheStoredPricing()
    {
        var created = await CreateAsync(new { name = $"Stable {Marker}", pricePerNight = 300m, discountPercent = 10 });
        var id = created.GetProperty("id").GetGuid();

        var response = await administrator.PutAsJsonAsync($"/api/hotels/{id}", new { name = $"Stable {Marker}", discountPercent = 10 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await ReadJsonAsync(response)).GetProperty("errors").TryGetProperty("discountPercent", out _));
        AssertPricing(await ReadJsonAsync(await administrator.GetAsync($"/api/hotels/{id}")), 300m, 10, 270m);
    }

    [Theory]
    [InlineData("/api/hotels")]
    [InlineData("/api/public/hotels")]
    public async Task List_WithAMaximumPrice_KeepsTheHotelsWhoseEffectiveRateIsWithinIt(string route)
    {
        var client = route.Contains("public") ? anonymous : administrator;
        var plain = await CreateAsync(new { name = $"A Plain {Marker}", pricePerNight = 100m });
        var discounted = await CreateAsync(new { name = $"B Discounted {Marker}", pricePerNight = 200m, discountPercent = 50 });
        await CreateAsync(new { name = $"C Above {Marker}", pricePerNight = 150m });
        await CreateAsync(new { name = $"D Unpriced {Marker}" });

        var first = await ReadJsonAsync(await client.GetAsync($"{route}?name={Marker}&maxPrice=100&pageSize=1"));
        var second = await ReadJsonAsync(await client.GetAsync($"{route}?name={Marker}&maxPrice=100.00&pageSize=1&page=2"));

        Assert.Equal(2, first.GetProperty("totalItems").GetInt32());
        Assert.Equal(2, first.GetProperty("totalPages").GetInt32());
        Assert.Equal(plain.GetProperty("id").GetGuid(), SingleItem(first).GetProperty("id").GetGuid());
        Assert.Equal(discounted.GetProperty("id").GetGuid(), SingleItem(second).GetProperty("id").GetGuid());
    }

    [Theory]
    [InlineData("/api/hotels", "0")]
    [InlineData("/api/hotels", "-1")]
    [InlineData("/api/hotels", "cheap")]
    [InlineData("/api/public/hotels", "0")]
    [InlineData("/api/public/hotels", "-1")]
    [InlineData("/api/public/hotels", "cheap")]
    public async Task List_WithAnInvalidMaximumPrice_ReturnsTheValidationProblem(string route, string maximumPrice)
    {
        var client = route.Contains("public") ? anonymous : administrator;

        var response = await client.GetAsync($"{route}?maxPrice={maximumPrice}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await ReadJsonAsync(response);
        Assert.Equal(400, problem.GetProperty("status").GetInt32());
        Assert.NotEmpty(problem.GetProperty("errors").EnumerateObject());
    }

    [Fact]
    public async Task PricingWrites_KeepTheRoleBoundaries()
    {
        var name = $"Boundary {Marker}";

        var asUser = await user.PostAsJsonAsync("/api/hotels", new { name, pricePerNight = 100m });
        var asAnonymous = await anonymous.PostAsJsonAsync("/api/hotels", new { name, pricePerNight = 100m });
        var listAsAnonymous = await anonymous.GetAsync("/api/hotels?maxPrice=100");
        var listAsUser = await user.GetAsync("/api/hotels?maxPrice=100");

        Assert.Equal(HttpStatusCode.Forbidden, asUser.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, asAnonymous.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, listAsAnonymous.StatusCode);
        Assert.Equal(HttpStatusCode.OK, listAsUser.StatusCode);
        Assert.Equal(0, await CountHotelsAsync(name));
    }

    [Fact]
    public async Task PricingUpdates_ByAUser_AreForbiddenAndKeepTheStoredPricing()
    {
        var created = await CreateAsync(new { name = $"Guarded {Marker}", pricePerNight = 300m });
        var id = created.GetProperty("id").GetGuid();

        var response = await user.PutAsJsonAsync($"/api/hotels/{id}", new { name = $"Guarded {Marker}" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        AssertPricing(await ReadJsonAsync(await administrator.GetAsync($"/api/hotels/{id}")), 300m, null, null);
    }

    private static void AssertPricing(JsonElement hotel, decimal nightlyRate, int? discountPercent, decimal? discountedNightlyRate)
    {
        var pricing = hotel.GetProperty("pricing");
        Assert.Equal(
            ["currency", "nightlyRate", "discountPercent", "discountedNightlyRate"],
            pricing.EnumerateObject().Select(property => property.Name).ToArray());
        Assert.Equal("USD", pricing.GetProperty("currency").GetString());
        Assert.Equal(nightlyRate, pricing.GetProperty("nightlyRate").GetDecimal());
        Assert.Equal(discountPercent, ReadNullable(pricing.GetProperty("discountPercent"), element => element.GetInt32()));
        Assert.Equal(discountedNightlyRate, ReadNullable(pricing.GetProperty("discountedNightlyRate"), element => element.GetDecimal()));
    }

    private static T? ReadNullable<T>(JsonElement element, Func<JsonElement, T> read)
        where T : struct =>
        element.ValueKind == JsonValueKind.Null ? null : read(element);

    private static JsonElement SingleItem(JsonElement page) => Assert.Single(page.GetProperty("items").EnumerateArray().ToArray());

    private async Task<JsonElement> CreateAsync(object body)
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", body);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadJsonAsync(response);
    }

    private static Task<HttpResponseMessage> PostRawAsync(HttpClient client, string route, string name, string price, string discount)
    {
        var json = string.Create(
            CultureInfo.InvariantCulture,
            $"{{\"name\":{JsonSerializer.Serialize(name)},\"pricePerNight\":{price},\"discountPercent\":{discount}}}");
        return client.PostAsync(route, new StringContent(json, Encoding.UTF8, "application/json"));
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<JsonElement>()).Clone();

    private async Task<int> CountHotelsAsync(string name)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT count(*) FROM hotels WHERE name = @name", connection);
        command.Parameters.AddWithValue("name", name);
        return Convert.ToInt32(await command.ExecuteScalarAsync() ?? 0);
    }

    private async Task<string> SignInAsync(string email, string password)
    {
        var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await ReadJsonAsync(response)).GetProperty("accessToken").GetString()!;
    }
}
