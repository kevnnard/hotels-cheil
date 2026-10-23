using System.Security.Claims;
using System.Text;
using HotelManagement.Application.Identity;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace HotelManagement.Api.Authentication;

public sealed class JwtAccessTokenIssuer(IOptions<JwtOptions> options, TimeProvider clock) : IAccessTokenIssuer
{
    private readonly JwtOptions settings = options.Value;

    public IssuedToken Issue(Guid userId, Guid sessionId, string email, IReadOnlyList<string> roles)
    {
        var issuedAt = clock.GetUtcNow().UtcDateTime;
        var expiresAt = issuedAt.Add(settings.AccessTokenLifetime);

        var claims = new List<Claim>
        {
            new("sub", userId.ToString()),
            new("email", email),
            new("sid", sessionId.ToString())
        };
        claims.AddRange(roles.Select(role => new Claim("role", role)));

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = settings.Issuer,
            Audience = settings.Audience,
            Subject = new ClaimsIdentity(claims),
            IssuedAt = issuedAt,
            NotBefore = issuedAt,
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(settings.SigningKey)),
                SecurityAlgorithms.HmacSha256)
        };

        var handler = new JsonWebTokenHandler { SetDefaultTimesOnTokenCreation = false };
        return new IssuedToken(handler.CreateToken(descriptor), expiresAt, sessionId);
    }
}
