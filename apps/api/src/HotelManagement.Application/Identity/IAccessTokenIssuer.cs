namespace HotelManagement.Application.Identity;

public interface IAccessTokenIssuer
{
    IssuedToken Issue(Guid userId, Guid sessionId, string email, IReadOnlyList<string> roles);
}
