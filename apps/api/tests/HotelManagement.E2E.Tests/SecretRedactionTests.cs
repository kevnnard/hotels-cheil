namespace HotelManagement.E2E.Tests;

public sealed class SecretRedactionTests
{
    [Fact]
    public void The_redaction_removes_the_signing_key_the_password_and_the_connection_string()
    {
        var settings = new Dictionary<string, string>
        {
            ["Authentication__Jwt__SigningKey"] = "a-signing-key-value-0123456789",
            ["Authentication__Administrator__Password"] = "Administrator1",
            ["ConnectionStrings__Hotels"] = "Host=db;Database=hotels;Username=hotels;Password=s3cret"
        };

        var secrets = SecretRedactor.Secrets(settings);
        var text = "the signing key is a-signing-key-value-0123456789, the administrator password is Administrator1 "
            + "and the database password is s3cret";

        var redacted = SecretRedactor.Redact(text, secrets);

        Assert.DoesNotContain("a-signing-key-value-0123456789", redacted);
        Assert.DoesNotContain("Administrator1", redacted);
        Assert.DoesNotContain("s3cret", redacted);
        Assert.Contains("***", redacted);
    }

    [Fact]
    public void The_redaction_keeps_the_values_that_are_not_secrets()
    {
        var settings = new Dictionary<string, string>
        {
            ["Authentication__Jwt__Issuer"] = "hotels-e2e",
            ["Authentication__Jwt__AccessTokenLifetimeMinutes"] = "15"
        };

        var redacted = SecretRedactor.Redact("the issuer is hotels-e2e and the lifetime is 15", SecretRedactor.Secrets(settings));

        Assert.Equal("the issuer is hotels-e2e and the lifetime is 15", redacted);
    }
}
