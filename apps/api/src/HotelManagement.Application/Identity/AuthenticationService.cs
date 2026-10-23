using HotelManagement.Domain.Identity;

namespace HotelManagement.Application.Identity;

public sealed class AuthenticationService(
    IUserAccountStore accounts,
    ISessionStore sessions,
    IAccessTokenIssuer tokens,
    TimeProvider clock) : IAuthenticationService
{
    public async Task<RegistrationOutcome> RegisterAsync(RegisterAccount registration, CancellationToken cancellationToken)
    {
        if (!AccountRules.IsValidEmail(registration.Email))
        {
            return RegistrationOutcome.InvalidInput("email");
        }

        if (!AccountRules.IsValidPassword(registration.Password))
        {
            return RegistrationOutcome.InvalidInput("password");
        }

        var email = AccountRules.NormalizeEmail(registration.Email);
        if (await accounts.ExistsAsync(email, cancellationToken))
        {
            return RegistrationOutcome.EmailAlreadyRegistered();
        }

        var userId = Guid.CreateVersion7();
        var creation = await accounts.CreateAsync(userId, email, registration.Password, HotelRoles.User, cancellationToken);
        if (creation.Status == AccountCreationStatus.EmailAlreadyRegistered)
        {
            return RegistrationOutcome.EmailAlreadyRegistered();
        }

        return RegistrationOutcome.Registered(userId, email);
    }

    public async Task<SignInOutcome> SignInAsync(SignIn signIn, CancellationToken cancellationToken)
    {
        if (!AccountRules.IsValidEmail(signIn.Email))
        {
            return SignInOutcome.InvalidInput("email");
        }

        if (string.IsNullOrEmpty(signIn.Password))
        {
            return SignInOutcome.InvalidInput("password");
        }

        var email = AccountRules.NormalizeEmail(signIn.Email);
        var account = await accounts.FindByEmailAsync(email, cancellationToken);
        if (account is null || !await accounts.VerifyPasswordAsync(account.Id, signIn.Password, cancellationToken))
        {
            return SignInOutcome.InvalidCredentials();
        }

        var roles = await accounts.GetRolesAsync(account.Id, cancellationToken);
        var sessionId = Guid.CreateVersion7();
        var token = tokens.Issue(account.Id, sessionId, account.Email, roles);
        await sessions.CreateAsync(sessionId, account.Id, token.ExpiresAtUtc, cancellationToken);
        return SignInOutcome.Succeeded(account.Id, account.Email, roles, token);
    }

    public async Task<bool> EndSessionAsync(Guid sessionId, CancellationToken cancellationToken) =>
        await sessions.RevokeAsync(sessionId, cancellationToken);

    public async Task<bool> IsSessionActiveAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var state = await sessions.FindAsync(sessionId, cancellationToken);
        return state is not null && !state.Revoked && state.ExpiresAtUtc > clock.GetUtcNow().UtcDateTime;
    }

    public async Task<SessionState?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken) =>
        await sessions.FindAsync(sessionId, cancellationToken);
}
