namespace HotelManagement.E2E.Tests;

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

public sealed record HotelAddressResponse(string? Street, string? City, string? Region, string? Country, string? PostalCode);

public sealed record HotelContactResponse(string? Phone, string? Email, string? Website);

public sealed record RatingSummaryResponse(decimal Sum, int Count, decimal? Average);

public sealed record HotelResponse(
    Guid Id,
    string Name,
    string? Description,
    HotelAddressResponse Address,
    HotelContactResponse Contact,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    RatingSummaryResponse Rating);

public sealed record HotelPageResponse(
    IReadOnlyList<HotelResponse> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
