using HotelManagement.Application.Identity;
using Microsoft.AspNetCore.Identity;

namespace HotelManagement.Infrastructure.Identity;

public sealed class PostgresUserAccountStore(UserManager<ApplicationUser> users) : IUserAccountStore
{
    public async Task<bool> ExistsAsync(string email, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        return user is not null;
    }

    public async Task CreateAsync(Guid userId, string email, string password, string role, CancellationToken cancellationToken)
    {
        var user = new ApplicationUser
        {
            Id = userId,
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        var created = await users.CreateAsync(user, password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException(FailureMessage(created));
        }

        var assigned = await users.AddToRoleAsync(user, role);
        if (!assigned.Succeeded)
        {
            throw new InvalidOperationException(FailureMessage(assigned));
        }
    }

    public async Task<AccountIdentity?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        return user is null ? null : new AccountIdentity(user.Id, user.Email ?? email);
    }

    public async Task<bool> VerifyPasswordAsync(Guid userId, string password, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        return user is not null && await users.CheckPasswordAsync(user, password);
    }

    public async Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdAsync(userId.ToString());
        if (user is null)
        {
            return Array.Empty<string>();
        }

        var roles = await users.GetRolesAsync(user);
        return roles.ToArray();
    }

    private static string FailureMessage(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));
}
