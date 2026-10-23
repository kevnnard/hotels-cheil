namespace HotelManagement.Application.Identity;

public interface IAuthenticationService
{
    Task<RegistrationOutcome> RegisterAsync(RegisterAccount registration, CancellationToken cancellationToken);

    Task<SignInOutcome> SignInAsync(SignIn signIn, CancellationToken cancellationToken);

    Task<bool> EndSessionAsync(Guid sessionId, CancellationToken cancellationToken);

    Task<bool> IsSessionActiveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken);

    Task<SessionState?> GetSessionAsync(Guid sessionId, CancellationToken cancellationToken);
}
