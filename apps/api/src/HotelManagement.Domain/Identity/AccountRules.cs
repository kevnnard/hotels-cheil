namespace HotelManagement.Domain.Identity;

public static class AccountRules
{
    public const int EmailMaximumLength = 254;
    public const int PasswordMinimumLength = 8;
    public const int PasswordMaximumLength = 128;

    public static bool IsValidEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        var trimmed = email.Trim();
        if (trimmed.Length > EmailMaximumLength)
        {
            return false;
        }

        var separator = trimmed.IndexOf('@');
        if (separator <= 0 || separator != trimmed.LastIndexOf('@') || separator == trimmed.Length - 1)
        {
            return false;
        }

        var localPart = trimmed[..separator];
        var domain = trimmed[(separator + 1)..];
        if (localPart.Contains(' ') || domain.Contains(' '))
        {
            return false;
        }

        var dot = domain.IndexOf('.');
        return dot > 0 && dot < domain.Length - 1;
    }

    public static bool IsValidPassword(string? password)
    {
        if (string.IsNullOrEmpty(password))
        {
            return false;
        }

        if (password.Length < PasswordMinimumLength || password.Length > PasswordMaximumLength)
        {
            return false;
        }

        var hasLetter = false;
        var hasDigit = false;
        foreach (var character in password)
        {
            hasLetter |= char.IsLetter(character);
            hasDigit |= char.IsDigit(character);
        }

        return hasLetter && hasDigit;
    }

    public static string NormalizeEmail(string email) => email.Trim().ToLowerInvariant();
}
