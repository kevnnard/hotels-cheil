using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Text.Json;
using HotelManagement.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Api.Tests.Authentication;

[Collection(HotelApiCollection.Name)]
public class AuthenticationEndpointsTests(HotelApiFixture api)
{
    private const string Password = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private string Email { get; } = $"{Guid.CreateVersion7()}@example.com";

    [Fact]
    public async Task Register_WithAValidAccount_ReturnsCreated()
    {
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<RegisteredAccount>(Json);
        Assert.NotNull(created);
        Assert.Equal(Email, created!.Email);
        Assert.NotEqual(Guid.Empty, created.UserId);
    }

    [Fact]
    public async Task Register_WithAnAlreadyRegisteredEmail_ReturnsConflict()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        var response = await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Theory]
    [InlineData("not-an-email", "abcd1234")]
    [InlineData("user@example.com", "short")]
    public async Task Register_WithInvalidInput_ReturnsBadRequest(string email, string password)
    {
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/register", new { email, password });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Register_WithConcurrentRequestsForTheSameEmail_AnswersOneCreatedAndOneConflict()
    {
        using var client = api.CreateClient();
        var payload = new { email = Email, password = Password };

        var responses = await Task.WhenAll(
            client.PostAsJsonAsync("/api/auth/register", payload),
            client.PostAsJsonAsync("/api/auth/register", payload));

        var statuses = responses.Select(response => response.StatusCode).Order().ToArray();
        Assert.Equal(HttpStatusCode.Created, statuses[0]);
        Assert.Equal(HttpStatusCode.Conflict, statuses[1]);
    }

    [Fact]
    public async Task Register_NeverGrantsTheAdministratorRole()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        var token = await SignInAsync(client, Email, Password);

        Assert.Equal(new[] { HotelRoles.User }, token.Roles);
    }

    [Fact]
    public async Task Login_WithValidCredentials_ReturnsAnAccessToken()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        var token = await SignInAsync(client, Email, Password);

        Assert.False(string.IsNullOrWhiteSpace(token.AccessToken));
        Assert.NotEqual(Guid.Empty, token.SessionId);
        Assert.NotEqual(Guid.Empty, token.UserId);
        Assert.Equal(Email, token.Email);
        Assert.True(token.ExpiresAtUtc > DateTime.UtcNow);
    }

    [Fact]
    public async Task Login_WithAWrongPassword_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = "wrong1234" });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Login_WithAnUnknownEmail_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = Email, password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithoutAToken_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithAValidToken_ReturnsTheSignedInAccount()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });
        var token = await SignInAsync(client, Email, Password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var account = await response.Content.ReadFromJsonAsync<CurrentAccount>(Json);
        Assert.NotNull(account);
        Assert.Equal(token.UserId, account!.UserId);
        Assert.Equal(Email, account.Email);
        Assert.Equal(new[] { HotelRoles.User }, account.Roles);
        Assert.Equal(token.SessionId, account.SessionId);
    }

    [Fact]
    public async Task Me_WithAnExpiredToken_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(-1), sessionId: session.SessionId, userId: session.UserId));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenSignedWithAnotherKey_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15), signingKey: "another-signing-key-0123456789abcdef", sessionId: session.SessionId, userId: session.UserId));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenForAnotherAudience_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15), audience: "another-audience", sessionId: session.SessionId, userId: session.UserId));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenWithoutASession_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15)));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenForAnotherIssuer_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15), issuer: "another-issuer", sessionId: session.SessionId, userId: session.UserId));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenForAnUnknownSession_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15), sessionId: Guid.CreateVersion7(), userId: session.UserId));

        var response = await client.GetAsync("/api/auth/me");

        AssertInvalidTokenChallenge(response);
    }

    [Fact]
    public async Task Me_WithATokenOfAnotherAccountForAnOpenSession_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer",
            TestTokens.Create(DateTime.UtcNow.AddMinutes(15), sessionId: session.SessionId, userId: Guid.CreateVersion7()));

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Me_WithAnExpiredSession_ReturnsUnauthorized()
    {
        using var client = api.CreateClient();
        var session = await RegisterAndSignInAsync(client);
        await DatabaseQueries.ExpireSessionAsync(api.ConnectionString, session.SessionId);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);

        var response = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Logout_RevokesTheSessionAndTheTokenStopsWorking()
    {
        using var client = api.CreateClient();
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });
        var token = await SignInAsync(client, Email, Password);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var logout = await client.PostAsync("/api/auth/logout", null);
        var me = await client.GetAsync("/api/auth/me");

        Assert.Equal(HttpStatusCode.NoContent, logout.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Policies_AllowReadingForBothRoles_AndWritesOnlyForAdministrators()
    {
        var authorization = api.Services.GetRequiredService<IAuthorizationService>();
        var administrator = Principal(HotelRoles.Administrator);
        var user = Principal(HotelRoles.User);

        Assert.True((await authorization.AuthorizeAsync(administrator, null, HotelPermissions.Read)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(user, null, HotelPermissions.Read)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(administrator, null, HotelPermissions.Create)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(administrator, null, HotelPermissions.Update)).Succeeded);
        Assert.True((await authorization.AuthorizeAsync(administrator, null, HotelPermissions.Delete)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(user, null, HotelPermissions.Create)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(user, null, HotelPermissions.Update)).Succeeded);
        Assert.False((await authorization.AuthorizeAsync(user, null, HotelPermissions.Delete)).Succeeded);
    }

    private static void AssertInvalidTokenChallenge(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Contains("invalid_token", response.Headers.WwwAuthenticate.ToString());
    }

    private static ClaimsPrincipal Principal(string role) =>
        new(new ClaimsIdentity([new Claim("role", role)], "Test", ClaimTypes.Name, "role"));

    private static async Task<SignInResult> SignInAsync(HttpClient client, string email, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        response.EnsureSuccessStatusCode();
        var result = await response.Content.ReadFromJsonAsync<SignInResult>(Json);
        return result ?? throw new InvalidOperationException("The sign in response has no body.");
    }

    private async Task<SignInResult> RegisterAndSignInAsync(HttpClient client)
    {
        await client.PostAsJsonAsync("/api/auth/register", new { email = Email, password = Password });
        return await SignInAsync(client, Email, Password);
    }

    private sealed record RegisteredAccount(Guid UserId, string Email);

    private sealed record CurrentAccount(Guid UserId, string Email, IReadOnlyList<string> Roles, Guid SessionId, DateTime ExpiresAtUtc);

    private sealed record SignInResult(string AccessToken, DateTime ExpiresAtUtc, Guid SessionId, Guid UserId, string Email, IReadOnlyList<string> Roles);
}
