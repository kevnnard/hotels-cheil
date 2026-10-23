using System.Net;
using System.Security.Cryptography;
using HotelManagement.TestSupport.Persistence;
using Npgsql;

namespace HotelManagement.E2E.Tests;

public sealed record StoredRating(Guid UserId, decimal Score);

public sealed class ApiServerFixture : IAsyncDisposable
{
    private const string Issuer = "hotels-e2e";
    private const string Audience = "hotels-e2e-clients";
    private readonly PostgresDatabaseFixture database = new();
    private readonly string signingKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    private ApiServerProcess? server;
    private Uri? baseAddress;

    public string AdministratorEmail { get; } = $"admin-{Guid.NewGuid():N}@hotels.test";

    public string AdministratorPassword { get; } = $"Aa1{Convert.ToHexString(RandomNumberGenerator.GetBytes(16))}";

    public string DatabaseName => database.DatabaseName;

    public Uri BaseAddress => baseAddress ?? throw new InvalidOperationException("The API server is not running.");

    public bool IsProcessRunning => server is not null && !server.HasExited;

    public int? ReleasedProcessId { get; private set; }

    public async Task StartAsync(
        Func<IReadOnlyDictionary<string, string>, IReadOnlyDictionary<string, string>>? configure = null,
        Func<PostgresDatabaseFixture, Task>? initializeDatabase = null,
        Func<Task>? failAfterStart = null)
    {
        try
        {
            if (initializeDatabase is null)
            {
                await database.InitializeAsync();
            }
            else
            {
                await initializeDatabase(database);
            }

            IReadOnlyDictionary<string, string> settings = StartupSettings();
            var controlled = settings.Keys.ToArray();
            if (configure is not null)
            {
                settings = configure(settings);
            }

            server = await ApiServerProcess.StartAsync("Production", settings, controlled);
            baseAddress = await server.WaitForAddressAsync(TimeSpan.FromSeconds(60));
            await WaitUntilHealthyAsync();

            if (failAfterStart is not null)
            {
                await failAfterStart();
            }
        }
        catch (Exception startupFailure)
        {
            await ReleaseAfterFailedStartAsync(startupFailure, async () => await DisposeAsync());
            throw;
        }
    }

    internal static async Task ReleaseAfterFailedStartAsync(Exception startupFailure, Func<Task> release)
    {
        try
        {
            await release();
        }
        catch (Exception releaseFailure)
        {
            throw new AggregateException(startupFailure, releaseFailure);
        }
    }

    public async ValueTask DisposeAsync()
    {
        try
        {
            if (server is not null)
            {
                ReleasedProcessId = server.ProcessId;
                await server.DisposeAsync();
            }
        }
        finally
        {
            server = null;
            await database.DisposeAsync();
        }
    }

    public Dictionary<string, string> StartupSettings() => new()
    {
        ["ConnectionStrings__Hotels"] = database.ConnectionString,
        ["Authentication__Jwt__Issuer"] = Issuer,
        ["Authentication__Jwt__Audience"] = Audience,
        ["Authentication__Jwt__SigningKey"] = signingKey,
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

    public async Task<string?> ReadHotelDescriptionAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(database.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT description FROM hotels WHERE id = @id", connection);
        command.Parameters.AddWithValue("id", hotelId);
        return (string?)await command.ExecuteScalarAsync();
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

    private async Task WaitUntilHealthyAsync()
    {
        using var probe = new HttpClient { BaseAddress = BaseAddress, Timeout = TimeSpan.FromSeconds(2) };
        var deadline = DateTimeOffset.UtcNow.AddSeconds(60);

        while (DateTimeOffset.UtcNow < deadline)
        {
            if (Server.HasExited)
            {
                await Server.WaitForOutputAsync();
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
            catch (TaskCanceledException)
            {
            }

            await Task.Delay(100);
        }

        throw new TimeoutException($"The API did not answer the health check. Output: {Server.CapturedOutput}");
    }

    private ApiServerProcess Server => server ?? throw new InvalidOperationException("The API server is not running.");
}
