using HotelManagement.Application.Identity;
using HotelManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.Infrastructure.Identity;

public sealed class PostgresSessionStore(HotelDbContext database, TimeProvider clock) : ISessionStore
{
    public async Task CreateAsync(Guid sessionId, Guid userId, DateTime expiresAtUtc, CancellationToken cancellationToken)
    {
        database.AuthSessions.Add(new AuthSession
        {
            Id = sessionId,
            UserId = userId,
            CreatedAtUtc = clock.GetUtcNow().UtcDateTime,
            ExpiresAtUtc = expiresAtUtc,
            RevokedAtUtc = null
        });

        await database.SaveChangesAsync(cancellationToken);
    }

    public async Task<SessionState?> FindAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await database.AuthSessions.AsNoTracking().FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken);
        return session is null ? null : new SessionState(session.UserId, session.ExpiresAtUtc, session.RevokedAtUtc is not null);
    }

    public async Task<bool> RevokeAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await database.AuthSessions.FirstOrDefaultAsync(item => item.Id == sessionId, cancellationToken);
        if (session is null)
        {
            return false;
        }

        if (session.RevokedAtUtc is null)
        {
            session.RevokedAtUtc = clock.GetUtcNow().UtcDateTime;
            await database.SaveChangesAsync(cancellationToken);
        }

        return true;
    }
}
