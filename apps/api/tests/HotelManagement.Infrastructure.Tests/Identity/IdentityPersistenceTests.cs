using HotelManagement.Application.Identity;
using HotelManagement.Domain.Identity;
using HotelManagement.Infrastructure.Identity;
using HotelManagement.Infrastructure.Tests.Persistence;
using HotelManagement.TestSupport.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Infrastructure.Tests.Identity;

[Collection(PostgresCollection.Name)]
public class IdentityPersistenceTests(PostgresDatabaseFixture database)
{
    private const string Password = "abcd1234";

    private string Email { get; } = $"{Guid.CreateVersion7()}@example.com";

    [Fact]
    public async Task CreatedAccount_IsFoundByEmailWithTheUserRole()
    {
        using var scope = database.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccountStore>();
        var userId = Guid.CreateVersion7();
        await SeedRoleAsync(scope, HotelRoles.User);

        await accounts.CreateAsync(userId, Email, Password, HotelRoles.User, CancellationToken.None);

        var found = await accounts.FindByEmailAsync(Email, CancellationToken.None);
        Assert.NotNull(found);
        Assert.Equal(userId, found!.Id);
        Assert.Equal(Email, found.Email);
        Assert.True(await accounts.ExistsAsync(Email, CancellationToken.None));
        Assert.Equal(new[] { HotelRoles.User }, await accounts.GetRolesAsync(userId, CancellationToken.None));
    }

    [Fact]
    public async Task Password_IsStoredHashedAndOnlyTheCorrectPasswordVerifies()
    {
        using var scope = database.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccountStore>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var userId = Guid.CreateVersion7();
        await SeedRoleAsync(scope, HotelRoles.User);

        await accounts.CreateAsync(userId, Email, Password, HotelRoles.User, CancellationToken.None);

        var stored = await users.FindByEmailAsync(Email);
        Assert.NotNull(stored);
        Assert.NotEqual(Password, stored!.PasswordHash);
        Assert.True(await accounts.VerifyPasswordAsync(userId, Password, CancellationToken.None));
        Assert.False(await accounts.VerifyPasswordAsync(userId, "wrong1234", CancellationToken.None));
    }

    [Fact]
    public async Task Session_IsCreatedFoundAndRevoked()
    {
        using var scope = database.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccountStore>();
        var sessions = scope.ServiceProvider.GetRequiredService<ISessionStore>();
        var userId = Guid.CreateVersion7();
        await SeedRoleAsync(scope, HotelRoles.User);
        await accounts.CreateAsync(userId, Email, Password, HotelRoles.User, CancellationToken.None);
        var sessionId = Guid.CreateVersion7();
        var expiresAt = new DateTime(2026, 10, 23, 12, 15, 0, DateTimeKind.Utc);

        await sessions.CreateAsync(sessionId, userId, expiresAt, CancellationToken.None);

        var state = await sessions.FindAsync(sessionId, CancellationToken.None);
        Assert.NotNull(state);
        Assert.Equal(userId, state!.UserId);
        Assert.Equal(expiresAt, state.ExpiresAtUtc);
        Assert.False(state.Revoked);

        Assert.True(await sessions.RevokeAsync(sessionId, CancellationToken.None));
        var revoked = await sessions.FindAsync(sessionId, CancellationToken.None);
        Assert.NotNull(revoked);
        Assert.True(revoked!.Revoked);
        Assert.False(await sessions.RevokeAsync(Guid.CreateVersion7(), CancellationToken.None));
    }

    [Fact]
    public async Task DeletingAnAccount_RemovesItsSessions()
    {
        using var scope = database.Services.CreateScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccountStore>();
        var sessions = scope.ServiceProvider.GetRequiredService<ISessionStore>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var userId = Guid.CreateVersion7();
        await SeedRoleAsync(scope, HotelRoles.User);
        await accounts.CreateAsync(userId, Email, Password, HotelRoles.User, CancellationToken.None);
        var sessionId = Guid.CreateVersion7();
        await sessions.CreateAsync(sessionId, userId, DateTime.UtcNow.AddMinutes(15), CancellationToken.None);

        var stored = await users.FindByIdAsync(userId.ToString());
        Assert.NotNull(stored);
        var deleted = await users.DeleteAsync(stored!);
        Assert.True(deleted.Succeeded);

        Assert.Null(await sessions.FindAsync(sessionId, CancellationToken.None));
    }

    private static async Task SeedRoleAsync(IServiceScope scope, string role)
    {
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        if (!await roles.RoleExistsAsync(role))
        {
            await roles.CreateAsync(new IdentityRole<Guid>(role));
        }
    }
}
