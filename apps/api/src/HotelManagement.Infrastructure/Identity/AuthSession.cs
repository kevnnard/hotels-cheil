namespace HotelManagement.Infrastructure.Identity;

internal sealed class AuthSession
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime ExpiresAtUtc { get; set; }
    public DateTime? RevokedAtUtc { get; set; }
}
