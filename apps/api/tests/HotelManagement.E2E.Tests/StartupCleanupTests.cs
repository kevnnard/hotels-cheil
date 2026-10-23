using Npgsql;

namespace HotelManagement.E2E.Tests;

public sealed class StartupCleanupTests
{
    [Fact]
    public async Task A_start_that_fails_releases_the_database_and_the_process()
    {
        var harness = new ApiServerFixture();

        await Assert.ThrowsAsync<InvalidOperationException>(() => harness.StartAsync(settings =>
        {
            var broken = new Dictionary<string, string>(settings)
            {
                ["ConnectionStrings__Hotels"] = "Host=127.0.0.1;Port=1;Database=hotels;Username=hotels;Password=unused"
            };
            return broken;
        }));

        Assert.False(harness.IsProcessRunning);
        Assert.Equal(0, await CountDatabasesAsync(harness.DatabaseName));
    }

    [Fact]
    public async Task A_start_that_fails_while_the_database_is_created_releases_the_database()
    {
        var harness = new ApiServerFixture();

        await Assert.ThrowsAsync<InvalidOperationException>(() => harness.StartAsync(
            initializeDatabase: async database =>
            {
                await database.InitializeAsync();
                throw new InvalidOperationException("the schema migration failed");
            }));

        Assert.Equal(0, await CountDatabasesAsync(harness.DatabaseName));
    }

    private static async Task<int> CountDatabasesAsync(string name)
    {
        var administrative = Environment.GetEnvironmentVariable("HOTEL_TEST_CONNECTION");
        await using var connection = new NpgsqlConnection(administrative);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT COUNT(*) FROM pg_database WHERE datname = @name", connection);
        command.Parameters.AddWithValue("name", name);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }
}
