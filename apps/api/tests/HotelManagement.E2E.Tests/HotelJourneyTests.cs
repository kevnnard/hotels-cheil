using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class HotelJourneyTests(HotelApiServerFixture server)
{
    [Fact]
    public async Task A_registered_user_reads_the_catalog_and_cannot_write()
    {
        var email = UniqueEmail("guest");
        using var client = server.CreateClient();

        using var registration = await client.PostAsJsonAsync("/api/auth/register", new { email, password = GuestPassword });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        var registered = await registration.Content.ReadFromJsonAsync<RegisteredAccountResponse>();
        Assert.Equal(email, registered!.Email);

        var session = await SignInAsync(client, email, GuestPassword);
        Assert.Contains("User", session.Roles);
        Assert.DoesNotContain("Administrator", session.Roles);

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var account = await me.Content.ReadFromJsonAsync<CurrentAccountResponse>();
        Assert.Equal(email, account!.Email);
        Assert.Equal(session.SessionId, account.SessionId);
        Assert.Equal(session.UserId, account.UserId);

        using var list = await client.GetAsync("/api/hotels");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);

        var forbiddenName = UniqueName("Forbidden");
        using var create = await client.PostAsJsonAsync("/api/hotels", new { name = forbiddenName });
        Assert.Equal(HttpStatusCode.Forbidden, create.StatusCode);
        Assert.Equal(0, await server.CountHotelsAsync(forbiddenName));
    }

    [Fact]
    public async Task An_administrator_manages_the_catalog_and_a_user_rates_a_hotel()
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        Assert.Contains("Administrator", administrator.Roles);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);

        var name = UniqueName("Harbor");
        using var create = await client.PostAsJsonAsync("/api/hotels", new
        {
            name,
            description = "A quiet hotel near the harbor",
            street = "1 Dock Road",
            city = "Rotterdam",
            region = "Zuid-Holland",
            country = "Netherlands",
            postalCode = "3011",
            phone = "+31 10 1234567",
            email = "contact@harbor.test",
            website = "https://harbor.test"
        });
        Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        Assert.NotNull(create.Headers.Location);

        var hotel = await create.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.NotNull(hotel);
        Assert.Equal(name, hotel!.Name);
        Assert.Equal("Rotterdam", hotel.Address.City);
        Assert.Equal("contact@harbor.test", hotel.Contact.Email);
        Assert.True(hotel.IsActive);
        Assert.Equal(0, hotel.Rating.Count);
        Assert.Null(hotel.Rating.Average);
        Assert.Contains(hotel.Id.ToString(), create.Headers.Location!.ToString());

        using var read = await client.GetAsync($"/api/hotels/{hotel.Id}");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        var fetched = await read.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal(hotel.Id, fetched!.Id);
        Assert.Equal(hotel.Name, fetched.Name);

        using var update = await client.PutAsJsonAsync($"/api/hotels/{hotel.Id}", new
        {
            name,
            description = "A quiet hotel near the harbor and the station",
            city = "Rotterdam"
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal("A quiet hotel near the harbor and the station", updated!.Description);
        Assert.Equal(name, await server.ReadHotelNameAsync(hotel.Id));

        using var filtered = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(name)}");
        Assert.Equal(HttpStatusCode.OK, filtered.StatusCode);
        var page = await filtered.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Contains(page!.Items, item => item.Id == hotel.Id);

        var guestEmail = UniqueEmail("rater");
        using var guestClient = server.CreateClient();
        using var registration = await guestClient.PostAsJsonAsync("/api/auth/register", new { email = guestEmail, password = GuestPassword });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        var guest = await SignInAsync(guestClient, guestEmail, GuestPassword);
        guestClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", guest.AccessToken);

        using var rating = await guestClient.PostAsJsonAsync($"/api/hotels/{hotel.Id}/ratings", new { score = 4m });
        Assert.Equal(HttpStatusCode.OK, rating.StatusCode);
        var summary = await rating.Content.ReadFromJsonAsync<RatingSummaryResponse>();
        Assert.Equal(4m, summary!.Sum);
        Assert.Equal(1, summary.Count);
        Assert.Equal(4m, summary.Average);

        using var secondRating = await guestClient.PostAsJsonAsync($"/api/hotels/{hotel.Id}/ratings", new { score = 2m });
        Assert.Equal(HttpStatusCode.OK, secondRating.StatusCode);
        var replaced = await secondRating.Content.ReadFromJsonAsync<RatingSummaryResponse>();
        Assert.Equal(2m, replaced!.Sum);
        Assert.Equal(1, replaced.Count);
        Assert.Equal(2m, replaced.Average);

        var stored = await server.ReadRatingsAsync(hotel.Id);
        var vote = Assert.Single(stored);
        Assert.Equal(guest.UserId, vote.UserId);
        Assert.Equal(2m, vote.Score);

        using var above = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(name)}&minRating=3");
        Assert.Equal(HttpStatusCode.OK, above.StatusCode);
        var abovePage = await above.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.DoesNotContain(abovePage!.Items, item => item.Id == hotel.Id);

        using var below = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(name)}&minRating=2");
        Assert.Equal(HttpStatusCode.OK, below.StatusCode);
        var belowPage = await below.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Contains(belowPage!.Items, item => item.Id == hotel.Id);
    }

    [Fact]
    public async Task The_catalog_is_paginated_over_http()
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);

        var group = UniqueName("Group");
        var names = new[] { $"{group} One", $"{group} Two", $"{group} Three" };
        foreach (var hotelName in names)
        {
            using var create = await client.PostAsJsonAsync("/api/hotels", new { name = hotelName });
            Assert.Equal(HttpStatusCode.Created, create.StatusCode);
        }

        var query = $"/api/hotels?name={Uri.EscapeDataString(group)}&pageSize=2&page=1";
        using var first = await client.GetAsync(query);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var firstPage = await first.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(1, firstPage!.Page);
        Assert.Equal(2, firstPage.PageSize);
        Assert.Equal(3, firstPage.TotalItems);
        Assert.Equal(2, firstPage.TotalPages);
        var firstNames = firstPage.Items.Select(item => item.Name).OrderBy(name => name).ToArray();
        Assert.Equal(names.Take(2).OrderBy(name => name).ToArray(), firstNames);

        using var second = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&pageSize=2&page=2");
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var secondPage = await second.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(2, secondPage!.Page);
        var secondNames = secondPage.Items.Select(item => item.Name).OrderBy(name => name).ToArray();
        Assert.Equal(names.Skip(2).OrderBy(name => name).ToArray(), secondNames);
    }

    [Fact]
    public async Task A_revoked_session_stops_working()
    {
        var email = UniqueEmail("revoked");
        using var client = server.CreateClient();

        using var registration = await client.PostAsJsonAsync("/api/auth/register", new { email, password = GuestPassword });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);

        var session = await SignInAsync(client, email, GuestPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        using var beforeLogout = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, beforeLogout.StatusCode);

        using var logout = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);

        using var afterLogout = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, afterLogout.StatusCode);

        using var anonymous = await server.CreateClient().GetAsync("/api/hotels");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    private static async Task<SignInResponse> SignInAsync(HttpClient client, string email, string password)
    {
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var session = await response.Content.ReadFromJsonAsync<SignInResponse>();
        Assert.NotNull(session);
        return session!;
    }

    private const string GuestPassword = "Guest12345";

    private static string UniqueName(string prefix) => $"{prefix} {Guid.NewGuid():N}";

    private static string UniqueEmail(string prefix) => $"{prefix}-{Guid.NewGuid():N}@hotels.test";
}
