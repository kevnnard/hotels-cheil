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

public sealed record OwnRatingResponse(decimal? Score);

public sealed record HotelImageResponse(string ContentType, int Width, int Height, int SizeBytes);

public sealed record HotelPricingResponse(string Currency, decimal NightlyRate, int? DiscountPercent, decimal? DiscountedNightlyRate);

public sealed record HotelImageSlotResponse(int Position, string ContentType, int Width, int Height, int SizeBytes);

public sealed record HotelResponse(
    Guid Id,
    string Name,
    string? Description,
    HotelAddressResponse Address,
    HotelContactResponse Contact,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    RatingSummaryResponse Rating,
    HotelImageResponse? Image = null,
    IReadOnlyList<HotelImageSlotResponse>? Images = null,
    HotelPricingResponse? Pricing = null);

public sealed record HotelPageResponse(
    IReadOnlyList<HotelResponse> Items,
    int Page,
    int PageSize,
    int TotalItems,
    int TotalPages);
