namespace HotelManagement.Application.Identity;

public enum RegistrationStatus
{
    Registered,
    InvalidInput,
    EmailAlreadyRegistered
}

public sealed record RegistrationOutcome(RegistrationStatus Status, Guid UserId, string Email, string? InvalidField = null)
{
    public static RegistrationOutcome Registered(Guid userId, string email) => new(RegistrationStatus.Registered, userId, email);

    public static RegistrationOutcome InvalidInput(string field) => new(RegistrationStatus.InvalidInput, Guid.Empty, string.Empty, field);

    public static RegistrationOutcome EmailAlreadyRegistered() => new(RegistrationStatus.EmailAlreadyRegistered, Guid.Empty, string.Empty);
}
