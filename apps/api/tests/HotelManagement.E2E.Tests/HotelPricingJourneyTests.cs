using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class HotelPricingJourneyTests(HotelApiServerFixture server)
{
    [Fact]
    public async Task An_administrator_prices_a_hotel_and_a_visitor_finds_it_under_a_maximum_price()
    {
        using var client = server.CreateClient();
        using var login = await client.PostAsJsonAsync("/api/auth/login", new { email = server.AdministratorEmail, password = server.AdministratorPassword });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var session = await login.Content.ReadFromJsonAsync<SignInResponse>();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session!.AccessToken);

        var group = $"Priced {Guid.NewGuid():N}";
        using var create = await client.PostAsJsonAsync("/api/hotels", new { name = $"{group} Bay", city = "Lisbon", pricePerNight = 199.99m, discountPercent = 15 });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        var created = await create.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal(new HotelPricingResponse("USD", 199.99m, 15, 169.99m), created!.Pricing);

        using var dearCreate = await client.PostAsJsonAsync("/api/hotels", new { name = $"{group} Summit", pricePerNight = 450m });
        Assert.Equal(HttpStatusCode.Created, dearCreate.StatusCode);
        using var unpricedCreate = await client.PostAsJsonAsync("/api/hotels", new { name = $"{group} Plain" });
        Assert.Equal(HttpStatusCode.Created, unpricedCreate.StatusCode);

        using var adminList = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&maxPrice=170");
        Assert.Equal(HttpStatusCode.OK, adminList.StatusCode);
        var adminPage = await adminList.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(created.Id, Assert.Single(adminPage!.Items).Id);
        Assert.Equal(1, adminPage.TotalItems);

        using var visitor = server.CreateClient();
        using var publicList = await visitor.GetAsync($"/api/public/hotels?name={Uri.EscapeDataString(group)}&maxPrice=169.99");
        Assert.Equal(HttpStatusCode.OK, publicList.StatusCode);
        var publicPage = await publicList.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(created.Id, Assert.Single(publicPage!.Items).Id);

        using var tooLow = await visitor.GetAsync($"/api/public/hotels?name={Uri.EscapeDataString(group)}&maxPrice=169.98");
        Assert.Equal(0, (await tooLow.Content.ReadFromJsonAsync<HotelPageResponse>())!.TotalItems);

        using var invalid = await visitor.GetAsync("/api/public/hotels?maxPrice=0");
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        using var detail = await visitor.GetAsync($"/api/public/hotels/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, detail.StatusCode);
        var read = await detail.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal(new HotelPricingResponse("USD", 199.99m, 15, 169.99m), read!.Pricing);
        Assert.Equal("Lisbon", read.Address.City);
    }
}
