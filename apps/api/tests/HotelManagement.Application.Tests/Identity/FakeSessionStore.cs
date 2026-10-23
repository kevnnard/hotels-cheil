using HotelManagement.Application.Identity;

namespace HotelManagement.Application.Tests.Identity;

internal sealed class FakeSessionStore : ISessionStore
{
    private readonly Dictionary<Guid, (Guid UserId, DateTime ExpiresAtUtc, bool Revoked)> sessions = [];

    public int CreateCount { get; private set; }

    public Guid LastSessionId { get; private set; } = Guid.Empty;

    public Guid LastUserId { get; private set; } = Guid.Empty;

    public DateTime LastExpiresAtUtc { get; private set; } = DateTime.MinValue;

    public void AddSession(Guid sessionId, Guid userId, DateTime expiresAtUtc)
    {
        sessions[sessionId] = (userId, expiresAtUtc, false);
    }

    public Task CreateAsync(Guid sessionId, Guid userId, DateTime expiresAtUtc, CancellationToken cancellationToken)
    {
        sessions[sessionId] = (userId, expiresAtUtc, false);
        LastSessionId = sessionId;
        LastUserId = userId;
        LastExpiresAtUtc = expiresAtUtc;
        CreateCount++;
        return Task.CompletedTask;
    }

    public Task<SessionState?> FindAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var found = sessions.TryGetValue(sessionId, out var session)
            ? new SessionState(session.UserId, session.ExpiresAtUtc, session.Revoked)
            : null;
        return Task.FromResult(found);
    }

    public Task<bool> RevokeAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        if (!sessions.TryGetValue(sessionId, out var session))
        {
            return Task.FromResult(false);
        }

        sessions[sessionId] = (session.UserId, session.ExpiresAtUtc, true);
        return Task.FromResult(true);
    }
}
