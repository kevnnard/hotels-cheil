using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Domain.Identity;

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
        Assert.Equal(new[] { HotelRoles.Administrator }, token!.Roles);
    }

    [Fact]
    public async Task Bootstrap_CanRunTwiceWithoutFailing()
    {
        var email = $"{Guid.CreateVersion7()}@example.com";
        await using var first = new HotelApiFactory(api.ConnectionString, email, Password);
        await using var second = new HotelApiFactory(api.ConnectionString, email, Password);
        using var client = second.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password = Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task WithoutBootstrapConfiguration_NoAdministratorExists()
    {
        using var client = api.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new { email = "absent@example.com", password = Password });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed record SignInResult(IReadOnlyList<string> Roles);
}
