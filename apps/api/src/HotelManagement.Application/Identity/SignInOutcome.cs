namespace HotelManagement.Application.Identity;

public enum SignInStatus
{
    Succeeded,
    InvalidInput,
    InvalidCredentials
}

public sealed record SignInOutcome(SignInStatus Status, Guid UserId, string Email, IReadOnlyList<string> Roles, IssuedToken? Token, string? InvalidField = null)
{
    public static SignInOutcome Succeeded(Guid userId, string email, IReadOnlyList<string> roles, IssuedToken token) =>
        new(SignInStatus.Succeeded, userId, email, roles, token);

    public static SignInOutcome InvalidInput(string field) => new(SignInStatus.InvalidInput, Guid.Empty, string.Empty, [], null, field);

    public static SignInOutcome InvalidCredentials() => new(SignInStatus.InvalidCredentials, Guid.Empty, string.Empty, [], null);
}
