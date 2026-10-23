namespace HotelManagement.Api.Authentication;

public sealed record RegisterAccountRequest(string Email, string Password);

public sealed record SignInRequest(string Email, string Password);

public sealed record RegisteredAccountResponse(Guid UserId, string Email);

public sealed record SignInResponse(
    string AccessToken,
    DateTime ExpiresAtUtc,
    Guid SessionId,
    Guid UserId,
    string Email,
    IReadOnlyList<string> Roles);

public sealed record CurrentAccountResponse(
    Guid UserId,
    string Email,
    IReadOnlyList<string> Roles,
    Guid SessionId,
    DateTime ExpiresAtUtc);
