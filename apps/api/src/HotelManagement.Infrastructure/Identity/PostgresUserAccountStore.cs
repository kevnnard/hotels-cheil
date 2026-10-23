using HotelManagement.Application.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace HotelManagement.Infrastructure.Identity;

public sealed class PostgresUserAccountStore(UserManager<ApplicationUser> users) : IUserAccountStore
{
    public async Task<bool> ExistsAsync(string email, CancellationToken cancellationToken)
    {
        var user = await users.FindByEmailAsync(email);
        return user is not null;
    }

    public async Task<AccountCreation> CreateAsync(Guid userId, string email, string password, string role, CancellationToken cancellationToken)
    {
        var user = new ApplicationUser
        {
            Id = userId,
            UserName = email,
            Email = email,
            EmailConfirmed = true
        };

        IdentityResult created;
        try
        {
            created = await users.CreateAsync(user, password);
        }
        catch (DbUpdateException exception) when (IsDuplicateAccountViolation(exception))
        {
            return AccountCreation.EmailAlreadyRegistered;
        }

        if (!created.Succeeded)
        {
            if (created.Errors.Any(error => error.Code is "DuplicateUserName" or "DuplicateEmail"))
            {
                return AccountCreation.EmailAlreadyRegistered;
            }

            throw new InvalidOperationException(FailureMessage(created));
        }

        var assigned = await users.AddToRoleAsync(user, role);
        if (!assigned.Succeeded)
        {
            throw new InvalidOperationException(FailureMessage(assigned));
        }

        return AccountCreation.Created;
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

    private static bool IsDuplicateAccountViolation(DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres
        && postgres.ConstraintName is "UserNameIndex" or "EmailIndex";

    private static string FailureMessage(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));
}
