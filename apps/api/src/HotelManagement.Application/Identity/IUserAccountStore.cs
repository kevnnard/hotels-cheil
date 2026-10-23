namespace HotelManagement.Application.Identity;

public interface IUserAccountStore
{
    Task<bool> ExistsAsync(string email, CancellationToken cancellationToken);

    Task CreateAsync(Guid userId, string email, string password, string role, CancellationToken cancellationToken);

    Task<AccountIdentity?> FindByEmailAsync(string email, CancellationToken cancellationToken);

    Task<bool> VerifyPasswordAsync(Guid userId, string password, CancellationToken cancellationToken);

    Task<IReadOnlyList<string>> GetRolesAsync(Guid userId, CancellationToken cancellationToken);
}
