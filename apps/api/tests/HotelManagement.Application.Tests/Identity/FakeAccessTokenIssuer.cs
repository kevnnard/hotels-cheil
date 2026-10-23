using HotelManagement.Application.Identity;

namespace HotelManagement.Application.Tests.Identity;

internal sealed class FakeAccessTokenIssuer(DateTime now, TimeSpan lifetime) : IAccessTokenIssuer
{
    public Guid LastUserId { get; private set; } = Guid.Empty;

    public Guid LastSessionId { get; private set; } = Guid.Empty;

    public IReadOnlyList<string> LastRoles { get; private set; } = Array.Empty<string>();

    public IssuedToken Issue(Guid userId, Guid sessionId, string email, IReadOnlyList<string> roles)
    {
        LastUserId = userId;
        LastSessionId = sessionId;
        LastRoles = roles;
        return new IssuedToken($"token-for-{sessionId}", now.Add(lifetime), sessionId);
    }
}
