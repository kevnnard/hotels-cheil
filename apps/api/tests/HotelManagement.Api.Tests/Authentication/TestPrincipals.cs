using System.Text;
using System.Text.Json;

namespace HotelManagement.Api.Tests.Authentication;

internal static class TestPrincipals
{
    public static string TokenWithoutHotelRoles(string accessToken)
    {
        var (sessionId, userId) = ReadSession(accessToken);
        return TestTokens.Create(DateTime.UtcNow.AddMinutes(15), sessionId: sessionId, userId: userId, roles: ["Guest"]);
    }

    private static (Guid SessionId, Guid UserId) ReadSession(string accessToken)
    {
        var payload = accessToken.Split('.')[1];
        var padded = payload.Replace('-', '+').Replace('_', '/');
        padded += new string('=', (4 - padded.Length % 4) % 4);
        using var document = JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(padded)));
        var claims = document.RootElement;
        return (Guid.Parse(claims.GetProperty("sid").GetString()!), Guid.Parse(claims.GetProperty("sub").GetString()!));
    }
}
