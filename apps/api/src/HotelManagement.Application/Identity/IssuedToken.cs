namespace HotelManagement.Application.Identity;

public sealed record IssuedToken(string Value, DateTime ExpiresAtUtc, Guid SessionId);
