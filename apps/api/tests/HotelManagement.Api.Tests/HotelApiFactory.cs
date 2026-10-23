using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace HotelManagement.Api.Tests;

public sealed class HotelApiFactory : WebApplicationFactory<Program>
{
    private readonly string connectionString;
    private readonly string? administratorEmail;
    private readonly string? administratorPassword;

    public HotelApiFactory(string connectionString, string? administratorEmail = null, string? administratorPassword = null)
    {
        this.connectionString = connectionString;
        this.administratorEmail = administratorEmail;
        this.administratorPassword = administratorPassword;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Hotels", connectionString);
        builder.UseSetting("Authentication:Jwt:Issuer", "hotels-api-tests");
        builder.UseSetting("Authentication:Jwt:Audience", "hotels-api-tests-clients");
        builder.UseSetting("Authentication:Jwt:SigningKey", "hotels-api-tests-signing-key-0123456789abcdef");
        builder.UseSetting("Authentication:Jwt:AccessTokenLifetimeMinutes", "15");

        if (administratorEmail is not null)
        {
            builder.UseSetting("Authentication:Administrator:Email", administratorEmail);
        }

        if (administratorPassword is not null)
        {
            builder.UseSetting("Authentication:Administrator:Password", administratorPassword);
        }
    }
}
