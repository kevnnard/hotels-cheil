namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class ProductionStartupTests(HotelApiServerFixture server)
{
    private const string SigningKeySetting = "Authentication__Jwt__SigningKey";
    private const string AdministratorEmailSetting = "Authentication__Administrator__Email";
    private const string AdministratorPasswordSetting = "Authentication__Administrator__Password";
    private const string SigningKeyGuard = "Authentication:Jwt:SigningKey is required outside development";

    [Fact]
    public async Task The_api_refuses_to_start_without_a_signing_key()
    {
        var settings = server.StartupSettings();
        settings.Remove(SigningKeySetting);

        await AssertStartupRefusedAsync(settings, [SigningKeySetting], SigningKeyGuard);
    }

    [Fact]
    public async Task The_api_refuses_to_start_with_half_an_administrator_pair()
    {
        var settings = server.StartupSettings();
        settings.Remove(AdministratorEmailSetting);

        await AssertStartupRefusedAsync(
            settings,
            [AdministratorEmailSetting, AdministratorPasswordSetting],
            "Authentication:Administrator must define both Email and Password");
    }

    [Fact]
    public async Task The_startup_failure_message_keeps_the_fatal_output_of_the_process()
    {
        var settings = server.StartupSettings();
        settings.Remove(SigningKeySetting);

        await using var process = await ApiServerProcess.StartAsync(
            "Production",
            settings,
            removeFromEnvironment: [SigningKeySetting]);

        var failure = await Assert.ThrowsAsync<InvalidOperationException>(
            () => process.WaitForAddressAsync(TimeSpan.FromSeconds(30)));

        Assert.Contains(SigningKeyGuard, failure.Message);
    }

    [Theory]
    [InlineData("DOTNET_")]
    [InlineData("ASPNETCORE_")]
    public async Task The_api_refuses_to_start_when_a_prefixed_inherited_signing_key_reaches_it(string prefix)
    {
        var settings = server.StartupSettings();
        settings.Remove(SigningKeySetting);

        var variable = $"{prefix}{SigningKeySetting}";

        await AssertStartupRefusedAsync(
            settings,
            [SigningKeySetting],
            SigningKeyGuard,
            new Dictionary<string, string> { [variable] = "inherited-prefixed-signing-key-0123456789" });

        Assert.Null(Environment.GetEnvironmentVariable(variable));
    }

    private async Task AssertStartupRefusedAsync(
        Dictionary<string, string> settings,
        string[] removeFromEnvironment,
        string expectedMessage,
        IReadOnlyDictionary<string, string>? inheritedEnvironment = null)
    {
        await using var process = await ApiServerProcess.StartAsync(
            "Production",
            settings,
            removeFromEnvironment,
            inheritedEnvironment);
        await process.WaitForExitAsync(TimeSpan.FromSeconds(30));

        var output = process.RawCapturedOutput;
        Assert.NotEqual(0, process.ExitCode);
        Assert.Contains(expectedMessage, output);
        foreach (var secret in StartupSecrets())
        {
            Assert.False(output.Contains(secret, StringComparison.Ordinal), "The startup output must not contain a secret.");
        }
    }

    private string[] StartupSecrets()
    {
        var full = server.StartupSettings();
        return
        [
            full[SigningKeySetting],
            full[AdministratorPasswordSetting],
            SecretRedactor.PasswordOf(full["ConnectionStrings__Hotels"])
        ];
    }
}
