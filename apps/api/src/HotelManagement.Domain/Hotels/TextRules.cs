namespace HotelManagement.Domain.Hotels;

internal static class TextRules
{
    public static string RequiredText(string? value, string field, int maxLength)
    {
        var trimmed = value?.Trim();
        if (string.IsNullOrEmpty(trimmed))
        {
            throw new DomainValidationException($"{field} is required.");
        }

        return WithinLimit(trimmed, field, maxLength);
    }

    public static string? OptionalText(string? value, string field, int maxLength)
    {
        var trimmed = value?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : WithinLimit(trimmed, field, maxLength);
    }

    public static string? OptionalEmail(string? value)
    {
        var email = OptionalText(value, "Email", 254);
        if (email is null)
        {
            return null;
        }

        var parts = email.Split('@');
        var isWellFormed = parts.Length == 2
            && parts[0].Length > 0
            && parts[1].Contains('.')
            && !parts[1].StartsWith('.')
            && !parts[1].EndsWith('.')
            && !email.Any(char.IsWhiteSpace);

        return isWellFormed ? email : throw new DomainValidationException("Email is not valid.");
    }

    public static string? OptionalWebsite(string? value)
    {
        var website = OptionalText(value, "Website", 2048);
        if (website is null)
        {
            return null;
        }

        var isHttpUrl = Uri.TryCreate(website, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

        return isHttpUrl ? website : throw new DomainValidationException("Website must be an http or https URL.");
    }

    private static string WithinLimit(string value, string field, int maxLength) =>
        value.Length <= maxLength
            ? value
            : throw new DomainValidationException($"{field} cannot exceed {maxLength} characters.");
}
