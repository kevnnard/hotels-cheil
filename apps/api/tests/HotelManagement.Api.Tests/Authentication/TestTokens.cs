using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HotelManagement.Api.Tests.Authentication;

internal static class TestTokens
{
    public const string Issuer = "hotels-api-tests";
    public const string Audience = "hotels-api-tests-clients";
    public const string SigningKey = "hotels-api-tests-signing-key-0123456789abcdef";

    public static string Create(
        DateTime expiresAt,
        string signingKey = SigningKey,
        string issuer = Issuer,
        string audience = Audience,
        Guid? sessionId = null,
        Guid? userId = null)
    {
        var claims = new List<Claim>
        {
            new("sub", (userId ?? Guid.CreateVersion7()).ToString()),
            new("email", "token@example.com")
        };

        if (sessionId is not null)
        {
            claims.Add(new Claim("sid", sessionId.Value.ToString()));
        }

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = DateTime.UtcNow.AddMinutes(-30),
            NotBefore = DateTime.UtcNow.AddMinutes(-30),
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                SecurityAlgorithms.HmacSha256)
        };

        var handler = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false };
        return handler.CreateToken(descriptor);
    }
}
