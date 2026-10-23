namespace HotelManagement.E2E.Tests;

public sealed class HarnessCredentialsTests
{
    private const string SigningKeySetting = "Authentication__Jwt__SigningKey";

    [Fact]
    public async Task Each_fixture_generates_its_own_credentials()
    {
        await using var first = new ApiServerFixture();
        await using var second = new ApiServerFixture();

        Assert.NotEqual(first.StartupSettings()[SigningKeySetting], second.StartupSettings()[SigningKeySetting]);
        Assert.NotEqual(first.AdministratorPassword, second.AdministratorPassword);
    }

    [Fact]
    public async Task The_generated_credentials_are_strong_enough_for_the_api()
    {
        await using var fixture = new ApiServerFixture();

        Assert.True(fixture.StartupSettings()[SigningKeySetting].Length >= 48);
        Assert.True(fixture.AdministratorPassword.Length >= 16);
        Assert.Contains(fixture.AdministratorPassword, char.IsUpper);
        Assert.Contains(fixture.AdministratorPassword, char.IsLower);
        Assert.Contains(fixture.AdministratorPassword, char.IsDigit);
    }
}
