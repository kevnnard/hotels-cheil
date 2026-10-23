using System.Security.Cryptography;

namespace HotelManagement.Api.Authentication;

public sealed class JwtOptions
{
    public const string SectionName = "Authentication:Jwt";
    public const int MinimumSigningKeyLength = 32;

    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SigningKey { get; set; } = string.Empty;

    public int AccessTokenLifetimeMinutes { get; set; } = 15;

    public TimeSpan AccessTokenLifetime => TimeSpan.FromMinutes(AccessTokenLifetimeMinutes);

    public static JwtOptions Resolve(IConfiguration configuration, IHostEnvironment environment)
    {
        var options = new JwtOptions();
        configuration.GetSection(SectionName).Bind(options);
        options.Issuer = options.Issuer.Trim();
        options.Audience = options.Audience.Trim();
        options.SigningKey = options.SigningKey.Trim();

        if (options.SigningKey.Length == 0)
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException($"{SectionName}:SigningKey is required outside development.");
            }

            options.SigningKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        }

        if (options.SigningKey.Length < MinimumSigningKeyLength)
        {
            throw new InvalidOperationException($"{SectionName}:SigningKey must have at least {MinimumSigningKeyLength} characters.");
        }

        if (options.Issuer.Length == 0 || options.Audience.Length == 0)
        {
            throw new InvalidOperationException($"{SectionName} must define Issuer and Audience.");
        }

        if (options.AccessTokenLifetimeMinutes <= 0)
        {
            throw new InvalidOperationException($"{SectionName}:AccessTokenLifetimeMinutes must be greater than zero.");
        }

        return options;
    }
}
