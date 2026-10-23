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

        var group = UniqueName("Harbor");
        var harborName = $"{group} Quay";
        var marinaName = $"{group} Marina";
        var unrelatedName = UniqueName("Other");

        using var create = await client.PostAsJsonAsync("/api/hotels", new
        {
            name = harborName,
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

        var harbor = await create.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.NotNull(harbor);
        Assert.Equal(harborName, harbor!.Name);
        Assert.Equal("Rotterdam", harbor.Address.City);
        Assert.Equal("contact@harbor.test", harbor.Contact.Email);
        Assert.True(harbor.IsActive);
        Assert.Equal(0, harbor.Rating.Count);
        Assert.Null(harbor.Rating.Average);
        Assert.Equal($"/api/hotels/{harbor.Id}", create.Headers.Location!.AbsolutePath);

        using var read = await client.GetAsync($"/api/hotels/{harbor.Id}");
        Assert.Equal(HttpStatusCode.OK, read.StatusCode);
        var fetched = await read.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal(harbor.Id, fetched!.Id);
        Assert.Equal(harbor.Name, fetched.Name);

        var updatedDescription = "A quiet hotel near the harbor and the station";
        using var update = await client.PutAsJsonAsync($"/api/hotels/{harbor.Id}", new
        {
            name = harborName,
            description = updatedDescription,
            city = "Rotterdam"
        });
        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        var updated = await update.Content.ReadFromJsonAsync<HotelResponse>();
        Assert.Equal(updatedDescription, updated!.Description);
        Assert.Equal(updatedDescription, await server.ReadHotelDescriptionAsync(harbor.Id));
        Assert.Equal(harborName, await server.ReadHotelNameAsync(harbor.Id));

        using var marinaCreate = await client.PostAsJsonAsync("/api/hotels", new { name = marinaName });
        Assert.Equal(HttpStatusCode.Created, marinaCreate.StatusCode);
        var marina = await marinaCreate.Content.ReadFromJsonAsync<HotelResponse>();

        using var unrelatedCreate = await client.PostAsJsonAsync("/api/hotels", new { name = unrelatedName });
        Assert.Equal(HttpStatusCode.Created, unrelatedCreate.StatusCode);
        var unrelated = await unrelatedCreate.Content.ReadFromJsonAsync<HotelResponse>();

        using var filtered = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}");
        Assert.Equal(HttpStatusCode.OK, filtered.StatusCode);
        var page = await filtered.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(2, page!.TotalItems);
        Assert.Contains(page.Items, item => item.Id == harbor.Id);
        Assert.Contains(page.Items, item => item.Id == marina!.Id);
        Assert.DoesNotContain(page.Items, item => item.Id == unrelated!.Id);

        var guestEmail = UniqueEmail("rater");
        using var guestClient = server.CreateClient();
        using var registration = await guestClient.PostAsJsonAsync("/api/auth/register", new { email = guestEmail, password = GuestPassword });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        var guest = await SignInAsync(guestClient, guestEmail, GuestPassword);
        guestClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", guest.AccessToken);

        using var rating = await guestClient.PostAsJsonAsync($"/api/hotels/{harbor.Id}/ratings", new { score = 4m });
        Assert.Equal(HttpStatusCode.OK, rating.StatusCode);
        var summary = await rating.Content.ReadFromJsonAsync<RatingSummaryResponse>();
        Assert.Equal(4m, summary!.Sum);
        Assert.Equal(1, summary.Count);
        Assert.Equal(4m, summary.Average);

        using var secondRating = await guestClient.PostAsJsonAsync($"/api/hotels/{harbor.Id}/ratings", new { score = 2m });
        Assert.Equal(HttpStatusCode.OK, secondRating.StatusCode);
        var replaced = await secondRating.Content.ReadFromJsonAsync<RatingSummaryResponse>();
        Assert.Equal(2m, replaced!.Sum);
        Assert.Equal(1, replaced.Count);
        Assert.Equal(2m, replaced.Average);

        using var marinaRating = await guestClient.PostAsJsonAsync($"/api/hotels/{marina!.Id}/ratings", new { score = 4m });
        Assert.Equal(HttpStatusCode.OK, marinaRating.StatusCode);
        var marinaSummary = await marinaRating.Content.ReadFromJsonAsync<RatingSummaryResponse>();
        Assert.Equal(4m, marinaSummary!.Sum);
        Assert.Equal(1, marinaSummary.Count);

        var stored = await server.ReadRatingsAsync(harbor.Id);
        var vote = Assert.Single(stored);
        Assert.Equal(guest.UserId, vote.UserId);
        Assert.Equal(2m, vote.Score);

        using var above = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&minRating=3");
        Assert.Equal(HttpStatusCode.OK, above.StatusCode);
        var abovePage = await above.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(1, abovePage!.TotalItems);
        Assert.Contains(abovePage.Items, item => item.Id == marina!.Id);
        Assert.DoesNotContain(abovePage.Items, item => item.Id == harbor.Id);

        using var exact = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&minRating=4");
        Assert.Equal(HttpStatusCode.OK, exact.StatusCode);
        var exactPage = await exact.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(1, exactPage!.TotalItems);
        Assert.Contains(exactPage.Items, item => item.Id == marina!.Id);

        using var below = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&minRating=2");
        Assert.Equal(HttpStatusCode.OK, below.StatusCode);
        var belowPage = await below.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(2, belowPage!.TotalItems);
        Assert.Contains(belowPage.Items, item => item.Id == harbor.Id);

        using var delete = await client.DeleteAsync($"/api/hotels/{marina!.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);
        Assert.Equal(0, await server.CountHotelsAsync(marinaName));

        using var deletedRead = await client.GetAsync($"/api/hotels/{marina!.Id}");
        Assert.Equal(HttpStatusCode.NotFound, deletedRead.StatusCode);
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
        Assert.Equal(2, firstNames.Length);

        using var second = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(group)}&pageSize=2&page=2");
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var secondPage = await second.Content.ReadFromJsonAsync<HotelPageResponse>();
        Assert.Equal(2, secondPage!.Page);
        var secondNames = secondPage.Items.Select(item => item.Name).OrderBy(name => name).ToArray();
        Assert.Single(secondNames);
        Assert.Empty(firstNames.Intersect(secondNames));
        Assert.Equal(names.OrderBy(name => name).ToArray(), firstNames.Concat(secondNames).OrderBy(name => name).ToArray());
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

        using var anonymousClient = server.CreateClient();
        using var anonymous = await anonymousClient.GetAsync("/api/hotels");
        Assert.Equal(HttpStatusCode.Unauthorized, anonymous.StatusCode);
    }

    [Fact]
    public async Task The_health_endpoint_answers_healthy_without_authentication()
    {
        using var client = server.CreateClient();

        using var response = await client.GetAsync("/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Healthy", await response.Content.ReadAsStringAsync());
    }

    [Theory]
    [InlineData("0.99")]
    [InlineData("5.01")]
    [InlineData("-1")]
    [InlineData("100")]
    public async Task A_rating_outside_the_range_is_rejected_and_not_stored(string score)
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);

        using var create = await client.PostAsJsonAsync("/api/hotels", new { name = UniqueName("Unrated") });
        var hotel = await create.Content.ReadFromJsonAsync<HotelResponse>();

        using var rating = await client.PostAsync(
            $"/api/hotels/{hotel!.Id}/ratings",
            new StringContent($"{{\"score\":{score}}}", System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, rating.StatusCode);
        Assert.Empty(await server.ReadRatingsAsync(hotel.Id));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task A_hotel_without_a_usable_name_is_rejected(string name)
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);

        using var response = await client.PostAsJsonAsync("/api/hotels", new { name });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await server.CountHotelsAsync(name));
    }

    [Fact]
    public async Task A_hotel_name_longer_than_the_limit_is_rejected_and_not_stored()
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);
        var name = new string('x', 201);

        using var response = await client.PostAsJsonAsync("/api/hotels", new { name });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await server.CountHotelsAsync(name));
    }

    [Fact]
    public async Task A_hotel_update_with_an_invalid_name_is_rejected_and_keeps_the_stored_name()
    {
        using var client = server.CreateClient();
        var administrator = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administrator.AccessToken);
        var name = UniqueName("Stable");
        using var create = await client.PostAsJsonAsync("/api/hotels", new { name });
        var hotel = await create.Content.ReadFromJsonAsync<HotelResponse>();

        using var update = await client.PutAsJsonAsync($"/api/hotels/{hotel!.Id}", new { name = " " });

        Assert.Equal(HttpStatusCode.BadRequest, update.StatusCode);
        Assert.Equal(name, await server.ReadHotelNameAsync(hotel.Id));
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
