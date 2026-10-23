namespace HotelManagement.Application.Identity;

public enum AccountCreationStatus
{
    Created,
    EmailAlreadyRegistered
}

public sealed record AccountCreation(AccountCreationStatus Status)
{
    public static AccountCreation Created { get; } = new(AccountCreationStatus.Created);

    public static AccountCreation EmailAlreadyRegistered { get; } = new(AccountCreationStatus.EmailAlreadyRegistered);
}
