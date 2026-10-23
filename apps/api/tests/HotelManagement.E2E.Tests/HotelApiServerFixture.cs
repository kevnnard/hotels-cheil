using System.Net;
using HotelManagement.TestSupport.Persistence;
using Npgsql;

namespace HotelManagement.E2E.Tests;

public sealed record StoredRating(Guid UserId, decimal Score);

public sealed class HotelApiServerFixture : IAsyncLifetime
{
    private const string Issuer = "hotels-e2e";
    private const string Audience = "hotels-e2e-clients";
    private const string SigningKey = "hotels-e2e-signing-key-0123456789abcdefghijklmnop";

    private readonly PostgresDatabaseFixture database = new();
    private ApiServerProcess? server;

    public string AdministratorEmail { get; } = $"admin-{Guid.NewGuid():N}@hotels.test";

    public string AdministratorPassword { get; } = "Administrator1";

    public Uri BaseAddress => Server.BaseAddress;

    public async Task InitializeAsync()
    {
        await database.InitializeAsync();
        server = await ApiServerProcess.StartAsync("Production", StartupSettings());
        await WaitUntilHealthyAsync();
    }

    public async Task DisposeAsync()
    {
        if (server is not null)
        {
            await server.DisposeAsync();
            server = null;
        }

        await database.DisposeAsync();
    }

    public HttpClient CreateClient() => new()
    {
        BaseAddress = Server.BaseAddress,
        Timeout = TimeSpan.FromSeconds(30)
    };

    public Dictionary<string, string> StartupSettings() => new()
    {
        ["ConnectionStrings__Hotels"] = database.ConnectionString,
        ["Authentication__Jwt__Issuer"] = Issuer,
        ["Authentication__Jwt__Audience"] = Audience,
        ["Authentication__Jwt__SigningKey"] = SigningKey,
        ["Authentication__Jwt__AccessTokenLifetimeMinutes"] = "15",
        ["Authentication__Administrator__Email"] = AdministratorEmail,
        ["Authentication__Administrator__Password"] = AdministratorPassword
    };

    public async Task<int> CountHotelsAsync(string name)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT COUNT(*) FROM hotels WHERE name = @name", connection);
        command.Parameters.AddWithValue("name", name);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    public async Task<string?> ReadHotelNameAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT name FROM hotels WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", hotelId);
        return (string?)await command.ExecuteScalarAsync();
    }

    public async Task<IReadOnlyList<StoredRating>> ReadRatingsAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT user_id, score FROM hotel_ratings WHERE hotel_id = @hotelId ORDER BY user_id",
            connection);
        command.Parameters.AddWithValue("hotelId", hotelId);

        await using var reader = await command.ExecuteReaderAsync();
        var ratings = new List<StoredRating>();
        while (await reader.ReadAsync())
        {
            ratings.Add(new StoredRating(reader.GetGuid(0), reader.GetDecimal(1)));
        }

        return ratings;
    }

    private ApiServerProcess Server => server ?? throw new InvalidOperationException("The API server is not running.");

    private async Task WaitUntilHealthyAsync()
    {
        using var probe = new HttpClient { BaseAddress = Server.BaseAddress, Timeout = TimeSpan.FromSeconds(5) };
        var deadline = DateTimeOffset.UtcNow.AddSeconds(60);

        while (DateTimeOffset.UtcNow < deadline)
        {
            if (Server.HasExited)
            {
                throw new InvalidOperationException(
                    $"The API process exited with code {Server.ExitCode}. Output: {Server.CapturedOutput}");
            }

            try
            {
                using var response = await probe.GetAsync("/health");
                if (response.StatusCode == HttpStatusCode.OK)
                {
                    return;
                }
            }
            catch (HttpRequestException)
            {
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"The API did not answer the health check. Output: {Server.CapturedOutput}");
    }
}

[CollectionDefinition(Name)]
public sealed class E2ECollection : ICollectionFixture<HotelApiServerFixture>
{
    public const string Name = "HotelApiE2E";
}
