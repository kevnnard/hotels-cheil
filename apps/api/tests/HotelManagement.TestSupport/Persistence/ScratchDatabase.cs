using HotelManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HotelManagement.TestSupport.Persistence;

public sealed class ScratchDatabase(string connectionString, Func<Task> drop) : IAsyncDisposable
{
    public string ConnectionString => connectionString;

    public HotelDbContext CreateContext() =>
        new(new DbContextOptionsBuilder<HotelDbContext>().UseNpgsql(ConnectionString).Options);

    public async Task ExecuteAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    public async Task<List<object?[]>> QueryAsync(string sql)
    {
        await using var connection = new NpgsqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();
        var rows = new List<object?[]>();
        while (await reader.ReadAsync())
        {
            rows.Add(Enumerable.Range(0, reader.FieldCount).Select(index => reader.IsDBNull(index) ? null : reader.GetValue(index)).ToArray());
        }

        return rows;
    }

    public async ValueTask DisposeAsync()
    {
        using (var pooled = new NpgsqlConnection(ConnectionString))
        {
            NpgsqlConnection.ClearPool(pooled);
        }

        await drop();
    }
}
