using HotelManagement.Infrastructure;
using HotelManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;

namespace HotelManagement.TestSupport.Persistence;

public sealed class PostgresDatabaseFixture : IAsyncLifetime
{
    private const string ConnectionVariable = "HOTEL_TEST_CONNECTION";
    private const string AdministrativeDatabase = "hotels_test";

    private string administrativeConnectionString = string.Empty;
    private string databaseName = string.Empty;
    private ServiceProvider? services;

    public string ConnectionString { get; private set; } = string.Empty;

    public IServiceProvider Services => services ?? throw new InvalidOperationException("The fixture is not initialized.");

    public async Task InitializeAsync()
    {
        var configured = Environment.GetEnvironmentVariable(ConnectionVariable);
        if (string.IsNullOrWhiteSpace(configured))
        {
            throw new InvalidOperationException(
                $"{ConnectionVariable} must point to the isolated '{AdministrativeDatabase}' database. PostgreSQL tests never skip silently.");
        }

        var administrative = new NpgsqlConnectionStringBuilder(configured);
        if (administrative.Database != AdministrativeDatabase)
        {
            throw new InvalidOperationException(
                $"{ConnectionVariable} must use Database={AdministrativeDatabase}; refusing to run against another database.");
        }

        administrativeConnectionString = administrative.ConnectionString;
        databaseName = $"{AdministrativeDatabase}_{Guid.NewGuid():N}";
        ConnectionString = new NpgsqlConnectionStringBuilder(configured) { Database = databaseName }.ConnectionString;

        await ExecuteAdministrativeAsync($"CREATE DATABASE \"{databaseName}\"");

        await using var context = CreateContext();
        await context.Database.MigrateAsync();

        var registrations = new ServiceCollection();
        registrations.AddLogging();
        registrations.AddHotelPersistence(ConnectionString);
        registrations.AddHotelIdentity();
        registrations.AddSingleton(TimeProvider.System);
        services = registrations.BuildServiceProvider();
    }

    public async Task DisposeAsync()
    {
        if (services is not null)
        {
            await services.DisposeAsync();
            services = null;
        }

        if (databaseName.Length == 0)
        {
            return;
        }

        NpgsqlConnection.ClearAllPools();
        await ExecuteAdministrativeAsync($"DROP DATABASE IF EXISTS \"{databaseName}\" WITH (FORCE)");
    }

    public HotelDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<HotelDbContext>().UseNpgsql(ConnectionString).Options);

    public PostgresHotelStore CreateStore() => new(CreateContext());

    public PostgresHotelRatingStore CreateRatingStore() => new(CreateContext());

    public async Task<PostgresException?> TryExecuteAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        try
        {
            await command.ExecuteNonQueryAsync();
            return null;
        }
        catch (PostgresException exception)
        {
            return exception;
        }
    }

    private async Task ExecuteAdministrativeAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(administrativeConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }
}
