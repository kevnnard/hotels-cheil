namespace HotelManagement.Application.Identity;

public sealed record SessionState(Guid UserId, DateTime ExpiresAtUtc, bool Revoked);
