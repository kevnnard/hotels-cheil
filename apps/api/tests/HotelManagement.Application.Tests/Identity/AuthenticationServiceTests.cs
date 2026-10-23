using HotelManagement.Application.Identity;
using HotelManagement.Domain.Identity;

namespace HotelManagement.Application.Tests.Identity;

public class AuthenticationServiceTests
{
    private static readonly DateTime Now = new(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc);

    private readonly FakeUserAccountStore accounts = new();
    private readonly FakeSessionStore sessions = new();
    private readonly FakeAccessTokenIssuer tokens = new(Now, TimeSpan.FromMinutes(15));
    private readonly FixedTimeProvider clock = new(Now);

    private AuthenticationService Service => new(accounts, sessions, tokens, clock);

    [Theory]
    [InlineData("not-an-email", "abcd1234")]
    [InlineData("user@example.com", "short")]
    [InlineData("user@example.com", "nodigits")]
    public async Task Register_WithInvalidInput_IsRejected(string email, string password)
    {
        var outcome = await Service.RegisterAsync(new RegisterAccount(email, password), CancellationToken.None);

        Assert.Equal(RegistrationStatus.InvalidInput, outcome.Status);
        Assert.Equal(0, accounts.CreateCount);
    }

    [Fact]
    public async Task Register_CreatesTheAccountWithTheUserRoleAndNormalizedEmail()
    {
        var outcome = await Service.RegisterAsync(new RegisterAccount("  User@Example.COM ", "abcd1234"), CancellationToken.None);

        Assert.Equal(RegistrationStatus.Registered, outcome.Status);
        Assert.Equal("user@example.com", outcome.Email);
        Assert.Equal(1, accounts.CreateCount);
        Assert.Equal("user@example.com", accounts.LastCreatedEmail);
        Assert.Equal(HotelRoles.User, accounts.LastCreatedRole);
        Assert.NotEqual(Guid.Empty, accounts.LastCreatedUserId);
    }

    [Fact]
    public async Task Register_WithAnExistingEmail_DoesNotCreateASecondAccount()
    {
        accounts.Add("user@example.com", Guid.CreateVersion7(), "abcd1234", HotelRoles.User);

        var outcome = await Service.RegisterAsync(new RegisterAccount("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.Equal(RegistrationStatus.EmailAlreadyRegistered, outcome.Status);
        Assert.Equal(0, accounts.CreateCount);
    }

    [Fact]
    public async Task Register_WhenAnotherRequestTakesTheEmailFirst_AnswersAlreadyRegistered()
    {
        accounts.RejectCreationAsAlreadyRegistered();

        var outcome = await Service.RegisterAsync(new RegisterAccount("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.Equal(RegistrationStatus.EmailAlreadyRegistered, outcome.Status);
    }

    [Theory]
    [InlineData("not-an-email", "abcd1234")]
    [InlineData("user@example.com", "")]
    public async Task SignIn_WithInvalidInput_IsRejected(string email, string password)
    {
        var outcome = await Service.SignInAsync(new SignIn(email, password), CancellationToken.None);

        Assert.Equal(SignInStatus.InvalidInput, outcome.Status);
        Assert.Null(outcome.Token);
    }

    [Fact]
    public async Task SignIn_WithAnUnknownAccount_IsRejected()
    {
        var outcome = await Service.SignInAsync(new SignIn("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.Equal(SignInStatus.InvalidCredentials, outcome.Status);
        Assert.Equal(0, sessions.CreateCount);
    }

    [Fact]
    public async Task SignIn_WithAWrongPassword_IsRejected()
    {
        accounts.Add("user@example.com", Guid.CreateVersion7(), "abcd1234", HotelRoles.User);

        var outcome = await Service.SignInAsync(new SignIn("user@example.com", "wrong1234"), CancellationToken.None);

        Assert.Equal(SignInStatus.InvalidCredentials, outcome.Status);
        Assert.Equal(0, sessions.CreateCount);
    }

    [Fact]
    public async Task SignIn_IssuesATokenAndOpensASessionForTheAccount()
    {
        var userId = Guid.CreateVersion7();
        accounts.Add("user@example.com", userId, "abcd1234", HotelRoles.User);

        var outcome = await Service.SignInAsync(new SignIn("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.Equal(SignInStatus.Succeeded, outcome.Status);
        Assert.NotNull(outcome.Token);
        Assert.Equal(userId, outcome.UserId);
        Assert.Equal(new[] { HotelRoles.User }, outcome.Roles);
        Assert.Equal(1, sessions.CreateCount);
        Assert.Equal(userId, sessions.LastUserId);
        Assert.Equal(outcome.Token!.SessionId, sessions.LastSessionId);
        Assert.Equal(outcome.Token.ExpiresAtUtc, sessions.LastExpiresAtUtc);
    }

    [Fact]
    public async Task EndSession_RevokesTheSession()
    {
        var userId = Guid.CreateVersion7();
        accounts.Add("user@example.com", userId, "abcd1234", HotelRoles.User);
        var first = await Service.SignInAsync(new SignIn("user@example.com", "abcd1234"), CancellationToken.None);
        var second = await Service.SignInAsync(new SignIn("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.True(await Service.EndSessionAsync(first.Token!.SessionId, CancellationToken.None));
        Assert.False(await Service.IsSessionActiveAsync(first.Token.SessionId, userId, CancellationToken.None));
        Assert.True(await Service.IsSessionActiveAsync(second.Token!.SessionId, userId, CancellationToken.None));
    }

    [Fact]
    public async Task IsSessionActive_ForALiveSession_IsTrue()
    {
        var userId = Guid.CreateVersion7();
        accounts.Add("user@example.com", userId, "abcd1234", HotelRoles.User);
        var outcome = await Service.SignInAsync(new SignIn("user@example.com", "abcd1234"), CancellationToken.None);

        Assert.True(await Service.IsSessionActiveAsync(outcome.Token!.SessionId, userId, CancellationToken.None));
    }

    [Fact]
    public async Task IsSessionActive_ForAnExpiredSession_IsFalse()
    {
        var sessionId = Guid.CreateVersion7();
        sessions.AddSession(sessionId, Guid.CreateVersion7(), Now.AddMinutes(-1));

        Assert.False(await Service.IsSessionActiveAsync(sessionId, Guid.CreateVersion7(), CancellationToken.None));
    }

    [Fact]
    public async Task IsSessionActive_ForASessionOfAnotherAccount_IsFalse()
    {
        var ownerId = Guid.CreateVersion7();
        var sessionId = Guid.CreateVersion7();
        sessions.AddSession(sessionId, ownerId, Now.AddMinutes(15));

        Assert.False(await Service.IsSessionActiveAsync(sessionId, Guid.CreateVersion7(), CancellationToken.None));
    }

    [Fact]
    public async Task IsSessionActive_ForAnUnknownSession_IsFalse()
    {
        Assert.False(await Service.IsSessionActiveAsync(Guid.CreateVersion7(), Guid.CreateVersion7(), CancellationToken.None));
        Assert.Null(await Service.GetSessionAsync(Guid.CreateVersion7(), CancellationToken.None));
    }
}
