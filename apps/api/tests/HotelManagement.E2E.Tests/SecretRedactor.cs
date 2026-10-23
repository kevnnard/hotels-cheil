using Npgsql;

namespace HotelManagement.E2E.Tests;

internal static class SecretRedactor
{
    private const int LongValueLength = 12;
    private const int SensitiveValueLength = 4;

    public static string[] Secrets(IReadOnlyDictionary<string, string> settings) =>
        settings.Select(setting => setting.Value)
            .Where(value => value.Length >= LongValueLength)
            .Concat(settings.Where(setting => IsSensitive(setting.Key) && setting.Value.Length >= SensitiveValueLength)
                .Select(setting => setting.Value))
            .Concat(settings.Where(setting => IsConnectionString(setting.Key))
                .Select(setting => PasswordOf(setting.Value)))
            .Where(value => value.Length > 0)
            .Distinct(StringComparer.Ordinal)
            .ToArray();

    public static string Redact(string text, IEnumerable<string> secrets)
    {
        var redacted = text;
        foreach (var secret in secrets.OrderByDescending(secret => secret.Length))
        {
            redacted = redacted.Replace(secret, "***", StringComparison.Ordinal);
        }

        return redacted;
    }

    public static bool IsSensitive(string key) =>
        key.Contains("Password", StringComparison.OrdinalIgnoreCase)
        || key.Contains("SigningKey", StringComparison.OrdinalIgnoreCase)
        || key.Contains("Secret", StringComparison.OrdinalIgnoreCase)
        || key.EndsWith("Token", StringComparison.OrdinalIgnoreCase)
        || key.EndsWith("Key", StringComparison.OrdinalIgnoreCase);

    public static bool IsConnectionString(string key) =>
        key.Contains("ConnectionStrings", StringComparison.OrdinalIgnoreCase);

    public static string PasswordOf(string connectionString)
    {
        try
        {
            return new NpgsqlConnectionStringBuilder(connectionString).Password ?? string.Empty;
        }
        catch (ArgumentException)
        {
            return string.Empty;
        }
    }
}
