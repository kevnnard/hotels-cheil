using HotelManagement.Domain.Identity;

namespace HotelManagement.Domain.Tests.Identity;

public class AccountRulesTests
{
    [Theory]
    [InlineData("user@example.com")]
    [InlineData("first.last@example.co.uk")]
    [InlineData("user+hotel@example.com")]
    public void ValidEmail_IsAccepted(string email)
    {
        Assert.True(AccountRules.IsValidEmail(email));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("user")]
    [InlineData("user@example")]
    [InlineData("user@.com")]
    [InlineData("user@example.")]
    [InlineData("user@@example.com")]
    [InlineData("@example.com")]
    [InlineData("user@")]
    [InlineData("first last@example.com")]
    public void InvalidEmail_IsRejected(string? email)
    {
        Assert.False(AccountRules.IsValidEmail(email));
    }

    [Fact]
    public void Email_LongerThanTheLimit_IsRejected()
    {
        var email = new string('a', AccountRules.EmailMaximumLength) + "@example.com";

        Assert.False(AccountRules.IsValidEmail(email));
    }

    [Fact]
    public void Email_IsTrimmedAndLowercased()
    {
        Assert.Equal("user@example.com", AccountRules.NormalizeEmail("  User@Example.COM  "));
    }

    [Theory]
    [InlineData("abcd1234")]
    [InlineData("hotel-admin-2026")]
    [InlineData("ClaveSegura9")]
    public void ValidPassword_IsAccepted(string password)
    {
        Assert.True(AccountRules.IsValidPassword(password));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("abc123")]
    [InlineData("abcdefgh")]
    [InlineData("12345678")]
    public void InvalidPassword_IsRejected(string? password)
    {
        Assert.False(AccountRules.IsValidPassword(password));
    }

    [Fact]
    public void Password_LongerThanTheLimit_IsRejected()
    {
        var password = new string('a', AccountRules.PasswordMaximumLength + 1) + "1";

        Assert.False(AccountRules.IsValidPassword(password));
    }
}
