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
    public void The_redaction_removes_the_longest_secret_before_the_one_it_contains()
    {
        var settings = new Dictionary<string, string>
        {
            ["Authentication__Jwt__SigningKey"] = "a-signing-key-value-0123456789",
            ["Authentication__Jwt__Audience"] = "a-signing-key-value-0123456789-and-more"
        };

        var secrets = SecretRedactor.Secrets(settings);
        var text = "the audience is a-signing-key-value-0123456789-and-more";

        var redacted = SecretRedactor.Redact(text, secrets);

        Assert.DoesNotContain("a-signing-key-value-0123456789-and-more", redacted);
        Assert.DoesNotContain("and-more", redacted);
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

    [Theory]
    [InlineData("Host=db;Port=not-a-port;Username=hotels;Password=s3cret-value")]
    [InlineData("Host=db;Bogus=1;Password=s3cret-value")]
    [InlineData("Host=db;Password=s3cret-value;;==;")]
    public void The_redaction_removes_the_password_of_a_connection_string_the_parser_rejects(string connectionString)
    {
        var settings = new Dictionary<string, string> { ["ConnectionStrings__Hotels"] = connectionString };

        var redacted = SecretRedactor.Redact("the database said s3cret-value", SecretRedactor.Secrets(settings));

        Assert.DoesNotContain("s3cret-value", redacted);
    }

    [Theory]
    [InlineData("")]
    [InlineData("not a connection string")]
    [InlineData("Host=db;Database=hotels")]
    public void The_redaction_survives_a_connection_string_without_a_password(string connectionString)
    {
        var settings = new Dictionary<string, string> { ["ConnectionStrings__Hotels"] = connectionString };

        var redacted = SecretRedactor.Redact("the database said hello", SecretRedactor.Secrets(settings));

        Assert.Equal("the database said hello", redacted);
    }
}
