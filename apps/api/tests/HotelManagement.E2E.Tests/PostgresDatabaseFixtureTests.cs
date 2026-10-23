using HotelManagement.TestSupport.Persistence;
using Npgsql;

namespace HotelManagement.E2E.Tests;

public sealed class PostgresDatabaseFixtureTests
{
    [Fact]
    public async Task Releasing_one_fixture_leaves_the_pooled_connections_of_another_fixture_alone()
    {
        var survivor = new PostgresDatabaseFixture();
        var released = new PostgresDatabaseFixture();
        await survivor.InitializeAsync();
        await released.InitializeAsync();

        try
        {
            await survivor.TryExecuteAsync("SELECT 1");
            var before = await CountSessionsAsync(survivor.DatabaseName);
            Assert.True(before > 0, "The survivor must hold a pooled connection for the check to mean anything.");

            await released.DisposeAsync();

            Assert.Equal(before, await CountSessionsAsync(survivor.DatabaseName));
        }
        finally
        {
            await survivor.DisposeAsync();
        }
    }

    private static async Task<int> CountSessionsAsync(string database)
    {
        var administrative = Environment.GetEnvironmentVariable("HOTEL_TEST_CONNECTION");
        await using var connection = new NpgsqlConnection(administrative);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT COUNT(*) FROM pg_stat_activity WHERE datname = @name", connection);
        command.Parameters.AddWithValue("name", database);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }
}
