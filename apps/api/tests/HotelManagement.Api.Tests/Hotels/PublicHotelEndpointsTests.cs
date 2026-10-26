using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Application.Persistence;
using HotelManagement.TestSupport.Images;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class PublicHotelEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private HotelApiFactory factory = null!;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient user = null!;
    private Guid userId;

    private string Marker { get; } = Guid.CreateVersion7().ToString("N");

    public async Task InitializeAsync()
    {
        factory = new HotelApiFactory(api.ConnectionString, AdministratorEmail, AdministratorPassword);
        anonymous = factory.CreateClient();
        administrator = factory.CreateClient();
        user = factory.CreateClient();

        var administratorToken = await SignInAsync(AdministratorEmail, AdministratorPassword);
        administrator.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administratorToken.AccessToken);

        var email = $"{Guid.CreateVersion7()}@example.com";
        await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = UserPassword });
        var userToken = await SignInAsync(email, UserPassword);
        userId = userToken.UserId;
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userToken.AccessToken);
    }

    public async Task DisposeAsync()
    {
        anonymous.Dispose();
        administrator.Dispose();
        user.Dispose();
        await factory.DisposeAsync();
    }

    [Fact]
    public async Task List_WithoutCredentials_ReturnsThePagedHotelsAnAdministratorCreated()
    {
        var first = await CreateHotelAsync($"Alpha {Marker}");
        var second = await CreateHotelAsync($"Beta {Marker}");

        var response = await anonymous.GetAsync($"/api/public/hotels?name={Marker}");

        var page = await ReadPageAsync(response);
        Assert.Equal([first.Id, second.Id], page.Items.Select(item => item.Id).Order().ToArray());
        Assert.Equal((1, 20, 2, 1), (page.Page, page.PageSize, page.TotalItems, page.TotalPages));
    }

    [Fact]
    public async Task List_WithoutAnyFilter_ReturnsTheDefaultPageShape()
    {
        await CreateHotelAsync($"Shape {Marker}");

        var page = await ReadPageAsync(await anonymous.GetAsync("/api/public/hotels"));

        Assert.Equal((1, 20), (page.Page, page.PageSize));
        Assert.NotEmpty(page.Items);
        Assert.True(page.TotalItems >= 1);
        Assert.True(page.TotalPages >= 1);
    }

    [Fact]
    public async Task List_FiltersByNameIgnoringLetterCase()
    {
        var match = await CreateHotelAsync($"Seaside {Marker}");
        await CreateHotelAsync($"Mountain {Marker}");

        var page = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name=SEASIDE%20{Marker.ToUpperInvariant()}"));

        Assert.Equal(match.Id, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task List_FiltersByMinimumRating()
    {
        var high = await CreateHotelAsync($"High {Marker}");
        var low = await CreateHotelAsync($"Low {Marker}");
        var unrated = await CreateHotelAsync($"Unrated {Marker}");
        await RateAsync(high.Id, 5m);
        await RateAsync(low.Id, 2m);

        var page = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}&minRating=4"));

        Assert.Equal(high.Id, Assert.Single(page.Items).Id);
        Assert.DoesNotContain(page.Items, item => item.Id == low.Id || item.Id == unrated.Id);
        Assert.Equal(1, page.TotalItems);
    }

    [Fact]
    public async Task List_Paginates()
    {
        for (var index = 1; index <= 3; index++)
        {
            await CreateHotelAsync($"Paged {index} {Marker}");
        }

        var first = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}&page=1&pageSize=2"));
        var second = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}&page=2&pageSize=2"));

        Assert.Equal(2, first.Items.Count);
        Assert.Single(second.Items);
        Assert.Equal((3, 2), (first.TotalItems, first.TotalPages));
        Assert.Equal((2, 2), (second.Page, second.PageSize));
        Assert.Empty(first.Items.Select(item => item.Id).Intersect(second.Items.Select(item => item.Id)));
    }

    [Theory]
    [InlineData("pageSize=0")]
    [InlineData("pageSize=101")]
    [InlineData("page=0")]
    [InlineData("minRating=6")]
    [InlineData("minRating=-1")]
    public async Task List_WithAnInvalidQuery_ReturnsTheSameValidationErrorsAsTheAdministrativeList(string query)
    {
        var expected = await administrator.GetAsync($"/api/hotels?{query}");

        var response = await anonymous.GetAsync($"/api/public/hotels?{query}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, expected.StatusCode);
        Assert.Equal(await ErrorsOf(expected), await ErrorsOf(response));
    }

    [Fact]
    public async Task Get_WithoutCredentials_ReturnsTheSameFieldsAsTheAdministrativeGet()
    {
        var created = await CreateHotelAsync($"Detail {Marker}");
        await RateAsync(created.Id, 4m);

        var response = await anonymous.GetAsync($"/api/public/hotels/{created.Id}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var publicJson = await response.Content.ReadAsStringAsync();
        var adminJson = await (await administrator.GetAsync($"/api/hotels/{created.Id}")).Content.ReadAsStringAsync();
        Assert.Equal(PropertyNames(adminJson), PropertyNames(publicJson));
        Assert.Equal(adminJson, publicJson);
        Assert.Equal($"Detail {Marker}", JsonDocument.Parse(publicJson).RootElement.GetProperty("name").GetString());
    }

    [Fact]
    public async Task Get_OfAnUnknownHotel_ReturnsNotFound()
    {
        var response = await anonymous.GetAsync($"/api/public/hotels/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Image_WithoutCredentials_ReturnsTheStoredBytesWithTheCachingHeaders()
    {
        var hotel = await CreateHotelAsync($"Imaged {Marker}");
        var png = SmallPng();
        Assert.Equal(HttpStatusCode.OK, (await administrator.PutAsync($"/api/hotels/{hotel.Id}/image", Upload(png))).StatusCode);

        var response = await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/image");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        Assert.True(response.Headers.CacheControl?.Private);
        Assert.True(response.Headers.CacheControl?.NoCache);
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(png, await response.Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Image_OfAHotelWithoutAnImage_ReturnsNotFound()
    {
        var hotel = await CreateHotelAsync($"Bare {Marker}");

        var response = await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/image");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Image_OfAnUnknownHotel_ReturnsNotFound()
    {
        var response = await anonymous.GetAsync($"/api/public/hotels/{Guid.NewGuid()}/image");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AnInactiveHotel_IsAbsentFromThePublicList_ButStillPresentInTheAdministrativeList()
    {
        var active = await CreateHotelAsync($"Open {Marker}");
        var inactive = await CreateHotelAsync($"Closed {Marker}");
        await DeactivateAsync(inactive.Id);

        var publicPage = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}"));
        var adminPage = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}"));

        Assert.Equal(active.Id, Assert.Single(publicPage.Items).Id);
        Assert.Equal(1, publicPage.TotalItems);
        Assert.Equal(2, adminPage.TotalItems);
        Assert.Contains(adminPage.Items, item => item.Id == inactive.Id && !item.IsActive);
    }

    [Fact]
    public async Task AnInactiveHotel_ReturnsNotFoundOnThePublicDetailAndImage_ButNotOnTheAdministrativeEndpoints()
    {
        var hotel = await CreateHotelAsync($"Hidden {Marker}");
        Assert.Equal(HttpStatusCode.OK, (await administrator.PutAsync($"/api/hotels/{hotel.Id}/image", Upload(SmallPng()))).StatusCode);
        await DeactivateAsync(hotel.Id);

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/image")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await administrator.GetAsync($"/api/hotels/{hotel.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await administrator.GetAsync($"/api/hotels/{hotel.Id}/image")).StatusCode);
    }

    [Fact]
    public async Task AHotelDeactivatedThroughTheStatusEndpoint_IsHiddenFromEveryPublicRead_AndKeptInTheAdministrativeReads()
    {
        var visible = await CreateHotelAsync($"Lit {Marker}", 150m);
        var hidden = await CreateHotelAsync($"Dark {Marker}", 150m);
        await RateAsync(visible.Id, 5m);
        await RateAsync(hidden.Id, 5m);

        var status = await administrator.PutAsJsonAsync($"/api/hotels/{hidden.Id}/status", new { isActive = false });
        Assert.Equal(HttpStatusCode.OK, status.StatusCode);

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hidden.Id}")).StatusCode);
        foreach (var filter in new[] { "", "&maxPrice=200", "&minRating=4", "&maxPrice=200&minRating=4" })
        {
            var publicPage = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}{filter}"));
            Assert.Equal(visible.Id, Assert.Single(publicPage.Items).Id);
            Assert.Equal(1, publicPage.TotalItems);

            var adminPage = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}{filter}"));
            Assert.Equal(2, adminPage.TotalItems);
            Assert.Contains(adminPage.Items, item => item.Id == hidden.Id && !item.IsActive);
        }

        var adminDetail = await administrator.GetAsync($"/api/hotels/{hidden.Id}");
        Assert.Equal(HttpStatusCode.OK, adminDetail.StatusCode);
        Assert.False((await adminDetail.Content.ReadFromJsonAsync<HotelView>(Json))!.IsActive);
    }

    [Fact]
    public async Task AHotelReactivatedThroughTheStatusEndpoint_IsPublicAgain()
    {
        var hotel = await CreateHotelAsync($"Back {Marker}");
        await administrator.PutAsJsonAsync($"/api/hotels/{hotel.Id}/status", new { isActive = false });

        var status = await administrator.PutAsJsonAsync($"/api/hotels/{hotel.Id}/status", new { isActive = true });

        Assert.Equal(HttpStatusCode.OK, status.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}")).StatusCode);
        var page = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}"));
        Assert.Equal(hotel.Id, Assert.Single(page.Items).Id);
    }

    [Fact]
    public async Task TheAdministrativeReads_StillRequireAuthentication()
    {
        var hotel = await CreateHotelAsync($"Guarded {Marker}");

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/hotels")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/hotels/{hotel.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync($"/api/hotels/{hotel.Id}/image")).StatusCode);
    }

    [Fact]
    public async Task TheAdministrativeReads_StillServeAUser()
    {
        var hotel = await CreateHotelAsync($"Readable {Marker}");

        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync("/api/hotels")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await user.GetAsync($"/api/hotels/{hotel.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.PostAsJsonAsync("/api/hotels", Body($"Denied {Marker}"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await user.DeleteAsync($"/api/hotels/{hotel.Id}")).StatusCode);
    }

    private static async Task<string> ErrorsOf(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.GetProperty("errors").GetRawText();

    private static byte[] SmallPng() => TestImages.Png(RgbaImage.Noise(40, 30, 1, sixteenBit: true), depth: 16);

    private static MultipartFormDataContent Upload(byte[] content)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        return new MultipartFormDataContent { { file, "image", "photo.png" } };
    }

    private static string[] PropertyNames(string json) =>
        JsonDocument.Parse(json).RootElement.EnumerateObject().Select(property => property.Name).Order().ToArray();

    private async Task<HotelView> CreateHotelAsync(string name, decimal? pricePerNight = null)
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", Body(name, pricePerNight));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelView>(Json))!;
    }

    private async Task RateAsync(Guid hotelId, decimal score)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IHotelRatingsStore>().RateAsync(hotelId, userId, score, CancellationToken.None);
    }

    private async Task DeactivateAsync(Guid hotelId)
    {
        using var scope = factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IHotelStore>();
        Assert.True(await store.SetActiveAsync(hotelId, false, DateTime.UtcNow, CancellationToken.None));
    }

    private static async Task<HotelPageView> ReadPageAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelPageView>(Json))!;
    }

    private async Task<SignInView> SignInAsync(string email, string password)
    {
        var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SignInView>(Json))!;
    }

    private static object Body(string name, decimal? pricePerNight = null) => new
    {
        name,
        pricePerNight,
        description = "A quiet hotel",
        street = "1 Main Street",
        city = "Lisbon",
        region = "Lisbon District",
        country = "Portugal",
        postalCode = "1000-001",
        phone = "+351210000000",
        email = "front@example.com",
        website = "https://hotel.example.com"
    };

    private sealed record HotelView(Guid Id, string Name, bool IsActive);

    private sealed record HotelPageView(IReadOnlyList<HotelView> Items, int Page, int PageSize, int TotalItems, int TotalPages);

    private sealed record SignInView(string AccessToken, Guid UserId);
}
