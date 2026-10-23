using System.Security.Claims;
using HotelManagement.Application.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace HotelManagement.Api.Authentication;

[ApiController]
[Route("api/auth")]
public sealed class AuthenticationController(IAuthenticationService authentication) : ControllerBase
{
    private static readonly Dictionary<string, string> ValidationMessages = new()
    {
        ["email"] = "The email address is not valid.",
        ["password"] = "The password must have between 8 and 128 characters, with at least one letter and one digit."
    };

    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisteredAccountResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register([FromBody] RegisterAccountRequest request, CancellationToken cancellationToken)
    {
        var outcome = await authentication.RegisterAsync(new RegisterAccount(request.Email, request.Password), cancellationToken);

        return outcome.Status switch
        {
            RegistrationStatus.Registered => Created("/api/auth/me", new RegisteredAccountResponse(outcome.UserId, outcome.Email)),
            RegistrationStatus.EmailAlreadyRegistered => Conflict(new ProblemDetails
            {
                Title = "The email address is already registered.",
                Status = StatusCodes.Status409Conflict
            }),
            _ => InvalidInput(outcome.InvalidField)
        };
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(SignInResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login([FromBody] SignInRequest request, CancellationToken cancellationToken)
    {
        var outcome = await authentication.SignInAsync(new SignIn(request.Email, request.Password), cancellationToken);

        return outcome.Status switch
        {
            SignInStatus.Succeeded => Ok(new SignInResponse(
                outcome.Token!.Value,
                outcome.Token.ExpiresAtUtc,
                outcome.Token.SessionId,
                outcome.UserId,
                outcome.Email,
                outcome.Roles)),
            SignInStatus.InvalidCredentials => Unauthorized(new ProblemDetails
            {
                Title = "The email address or the password is not valid.",
                Status = StatusCodes.Status401Unauthorized
            }),
            _ => InvalidInput(outcome.InvalidField)
        };
    }

    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(CurrentAccountResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var sessionId = SessionId();
        var session = await authentication.GetSessionAsync(sessionId, cancellationToken);
        if (session is null)
        {
            return Unauthorized();
        }

        return Ok(new CurrentAccountResponse(
            UserId(),
            Email(),
            Roles(),
            sessionId,
            session.ExpiresAtUtc));
    }

    [HttpPost("logout")]
    [Authorize]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Logout(CancellationToken cancellationToken)
    {
        await authentication.EndSessionAsync(SessionId(), cancellationToken);
        return NoContent();
    }

    private IActionResult InvalidInput(string? field)
    {
        var key = field is not null && ValidationMessages.ContainsKey(field) ? field : "email";
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(key, ValidationMessages[key]);
        return ValidationProblem(modelState);
    }

    private Guid UserId() => Guid.Parse(User.FindFirst("sub")!.Value);

    private string Email() => User.FindFirst("email")!.Value;

    private Guid SessionId() => Guid.Parse(User.FindFirst("sid")!.Value);

    private IReadOnlyList<string> Roles() =>
        User.Claims.Where(claim => claim.Type is "role" or ClaimTypes.Role).Select(claim => claim.Value).Distinct().ToArray();
}
