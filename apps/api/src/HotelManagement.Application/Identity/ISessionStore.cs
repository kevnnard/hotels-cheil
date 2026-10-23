namespace HotelManagement.Application.Identity;

public interface ISessionStore
{
    Task CreateAsync(Guid sessionId, Guid userId, DateTime expiresAtUtc, CancellationToken cancellationToken);

    Task<SessionState?> FindAsync(Guid sessionId, CancellationToken cancellationToken);

    Task<bool> RevokeAsync(Guid sessionId, CancellationToken cancellationToken);
}
