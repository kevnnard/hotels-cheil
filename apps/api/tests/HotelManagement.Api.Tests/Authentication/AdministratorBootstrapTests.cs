using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Domain.Identity;
using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Api.Tests.Authentication;

[Collection(HotelApiCollection.Name)]
public class AdministratorBootstrapTests(HotelApiFixture api)
{
    private const string Password = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    [Fact]
    public async Task Bootstrap_CreatesAnAdministratorWithTheAdministratorRole()
    {
        var email = $"{Guid.CreateVersion7()}@example.com";
        await using var factory = new HotelApiFactory(api.ConnectionString, email, Password);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var token = await response.Content.ReadFromJsonAsync<SignInResult>(Json);
        Assert.NotNull(token);
        Assert.Contains(HotelRoles.Administrator, token!.Roles);
    }

    [Fact]
    public async Task Bootstrap_CanRunTwiceWithoutFailing()
    {
        var email = $"{Guid.CreateVersion7()}@example.com";
        await using var first = new HotelApiFactory(api.ConnectionString, email, Password);
        using var firstClient = first.CreateClient();
        await using var second = new HotelApiFactory(api.ConnectionString, email, Password);
        using var client = second.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Bootstrap_WithAnAccountThatHasNoAdministratorRole_AssignsTheRole()
    {
        var email = $"{Guid.CreateVersion7()}@example.com";
        using (var client = api.CreateClient())
        {
            await client.PostAsJsonAsync("/api/auth/register", new { email, password = Password });
        }

        await using var factory = new HotelApiFactory(api.ConnectionString, email, Password);
        using var bootstrapped = factory.CreateClient();
        var response = await bootstrapped.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var token = await response.Content.ReadFromJsonAsync<SignInResult>(Json);
        Assert.NotNull(token);
        Assert.Contains(HotelRoles.Administrator, token!.Roles);
    }

    [Fact]
    public void Bootstrap_WithOnlyTheEmailConfigured_RefusesToStart()
    {
        var email = $"{Guid.CreateVersion7()}@example.com";

        var exception = Assert.ThrowsAny<Exception>(() => new HotelApiFactory(api.ConnectionString, email).CreateClient());

        Assert.Contains("Authentication:Administrator", exception.ToString());
    }

    [Fact]
    public void Bootstrap_WithOnlyThePasswordConfigured_RefusesToStart()
    {
        var exception = Assert.ThrowsAny<Exception>(() => new HotelApiFactory(api.ConnectionString, administratorPassword: Password).CreateClient());

        Assert.Contains("Authentication:Administrator", exception.ToString());
    }

    [Fact]
    public async Task WithoutBootstrapConfiguration_NoAccountIsCreated()
    {
        await using var database = new PostgresDatabaseFixture();
        await database.InitializeAsync();
        await using var factory = new HotelApiFactory(database.ConnectionString);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "admin@example.com", password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal(0, await DatabaseQueries.CountAccountsAsync(database.ConnectionString));
        Assert.Equal(0, await DatabaseQueries.CountAdministratorsAsync(database.ConnectionString));
    }

    private sealed record SignInResult(IReadOnlyList<string> Roles);
}
