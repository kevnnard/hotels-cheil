using Microsoft.Extensions.Configuration;

namespace HotelManagement.Infrastructure.Identity;

public sealed class AdministratorBootstrapOptions
{
    public const string SectionName = "Authentication:Administrator";

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool IsConfigured => Email.Length > 0 && Password.Length > 0;

    public bool IsPartiallyConfigured => (Email.Length > 0) != (Password.Length > 0);

    public static AdministratorBootstrapOptions Resolve(IConfiguration configuration)
    {
        var section = configuration.GetSection(SectionName);
        var options = new AdministratorBootstrapOptions
        {
            Email = (section["Email"] ?? string.Empty).Trim(),
            Password = section["Password"] ?? string.Empty
        };

        if (options.IsPartiallyConfigured)
        {
            throw new InvalidOperationException($"{SectionName} must define both Email and Password.");
        }

        return options;
    }
}
