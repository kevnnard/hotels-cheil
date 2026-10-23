namespace HotelManagement.Api.Authentication;

public sealed class AdministratorBootstrapOptions
{
    public const string SectionName = "Authentication:Administrator";

    public string Email { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;

    public bool IsConfigured => Email.Length > 0 && Password.Length > 0;

    public bool IsPartiallyConfigured => (Email.Length > 0) != (Password.Length > 0);

    public static AdministratorBootstrapOptions Resolve(IConfiguration configuration)
    {
        var options = new AdministratorBootstrapOptions();
        configuration.GetSection(SectionName).Bind(options);
        options.Email = options.Email.Trim();

        if (options.IsPartiallyConfigured)
        {
            throw new InvalidOperationException($"{SectionName} must define both Email and Password.");
        }

        return options;
    }
}
