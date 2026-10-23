using Npgsql;

namespace HotelManagement.Api.Tests.Authentication;

internal static class DatabaseQueries
{
    public static async Task ExpireSessionAsync(string connectionString, Guid sessionId)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "UPDATE auth_sessions SET expires_at_utc = now() - interval '1 minute' WHERE id = @id",
            connection);
        command.Parameters.AddWithValue("id", sessionId);
        await command.ExecuteNonQueryAsync();
    }

    public static async Task<int> CountAdministratorsAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT count(*) FROM \"AspNetUserRoles\" ur JOIN \"AspNetRoles\" r ON r.id = ur.role_id WHERE r.name = 'Administrator'",
            connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync() ?? 0);
    }

    public static async Task<int> CountAccountsAsync(string connectionString)
    {
        await using var connection = new NpgsqlConnection(connectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand("SELECT count(*) FROM \"AspNetUsers\"", connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync() ?? 0);
    }
}
