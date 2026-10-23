namespace HotelManagement.Application.Identity;

public enum RegistrationStatus
{
    Registered,
    InvalidInput,
    EmailAlreadyRegistered
}

public sealed record RegistrationOutcome(RegistrationStatus Status, Guid UserId, string Email)
{
    public static RegistrationOutcome Registered(Guid userId, string email) => new(RegistrationStatus.Registered, userId, email);

    public static RegistrationOutcome InvalidInput { get; } = new(RegistrationStatus.InvalidInput, Guid.Empty, string.Empty);

    public static RegistrationOutcome EmailAlreadyRegistered { get; } = new(RegistrationStatus.EmailAlreadyRegistered, Guid.Empty, string.Empty);
}
