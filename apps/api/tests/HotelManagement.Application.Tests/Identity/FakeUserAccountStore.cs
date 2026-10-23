using HotelManagement.Application.Identity;

namespace HotelManagement.Application.Tests.Identity;

internal sealed class FakeUserAccountStore : IUserAccountStore
{
    private readonly Dictionary<string, (Guid Id, string Password, string Role)> accounts = new(StringComparer.OrdinalIgnoreCase);

    public Guid LastCreatedUserId { get; private set; } = Guid.Empty;

    public string LastCreatedEmail { get; private set; } = string.Empty;

    public string LastCreatedRole { get; private set; } = string.Empty;

    public int CreateCount { get; private set; }

    public void Add(string email, Guid id, string password, string role)
    {
        accounts[email] = (id, password, role);
    }

    public Task<bool> ExistsAsync(string email, CancellationToken cancellationToken) =>
        Task.FromResult(accounts.ContainsKey(email));

    public Task CreateAsync(Guid userId, string email, string password, string role, CancellationToken cancellationToken)
    {
        accounts[email] = (userId, password, role);
        LastCreatedUserId = userId;
        LastCreatedEmail = email;
        LastCreatedRole = role;
        CreateCount++;
        return Task.CompletedTask;
    }

    public Task<AccountIdentity?> FindByEmailAsync(string email, CancellationToken cancellationToken)
    {
        var found = accounts.TryGetValue(email, out var account)
            ? new AccountIdentity(account.Id, email)
            : null;
        return Task.FromResult(found);
    }

    public Task<bool> VerifyPasswordAsync(Guid userId, string password, CancellationToken cancellationToken)
    {
        var found = accounts.Values.FirstOrDefault(account => account.Id == userId);
        return Task.FromResult(found != default && found.Password == password);
    }

    public Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken cancellationToken)
    {
        var found = accounts.Values.FirstOrDefault(account => account.Id == userId);
        var roles = found == default ? Array.Empty<string>() : new[] { found.Role };
        return Task.FromResult<IReadOnlyList<string>>(roles);
    }
}
