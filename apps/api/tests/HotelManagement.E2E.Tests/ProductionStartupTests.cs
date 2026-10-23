namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class ProductionStartupTests(HotelApiServerFixture server)
{
    [Fact]
    public async Task The_api_refuses_to_start_without_a_signing_key()
    {
        var settings = server.StartupSettings();
        settings.Remove("Authentication__Jwt__SigningKey");

        await using var process = await ApiServerProcess.StartAsync(
            "Production",
            settings,
            removeFromEnvironment: ["Authentication__Jwt__SigningKey"]);
        await process.WaitForExitAsync(TimeSpan.FromSeconds(30));

        Assert.NotEqual(0, process.ExitCode);
        Assert.Contains("Authentication:Jwt:SigningKey is required outside development", process.CapturedOutput);
        Assert.False(
            process.RawCapturedOutput.Contains(server.AdministratorPassword, StringComparison.Ordinal),
            "The startup output must not contain the administrator password.");
    }

    [Fact]
    public async Task The_api_refuses_to_start_with_half_an_administrator_pair()
    {
        var settings = server.StartupSettings();
        settings.Remove("Authentication__Administrator__Email");

        await using var process = await ApiServerProcess.StartAsync(
            "Production",
            settings,
            removeFromEnvironment: ["Authentication__Administrator__Email", "Authentication__Administrator__Password"]);
        await process.WaitForExitAsync(TimeSpan.FromSeconds(30));

        Assert.NotEqual(0, process.ExitCode);
        Assert.Contains("Authentication:Administrator must define both Email and Password", process.CapturedOutput);
        Assert.False(
            process.RawCapturedOutput.Contains(server.AdministratorPassword, StringComparison.Ordinal),
            "The startup output must not contain the administrator password.");
    }

    [Fact]
    public async Task The_startup_failure_message_keeps_the_fatal_output_of_the_process()
    {
        var settings = server.StartupSettings();
        settings.Remove("Authentication__Jwt__SigningKey");

        await using var process = await ApiServerProcess.StartAsync(
            "Production",
            settings,
            removeFromEnvironment: ["Authentication__Jwt__SigningKey"]);

        var failure = await Assert.ThrowsAsync<InvalidOperationException>(
            () => process.WaitForAddressAsync(TimeSpan.FromSeconds(30)));

        Assert.Contains("Authentication:Jwt:SigningKey is required outside development", failure.Message);
    }

    [Theory]
    [InlineData("DOTNET_")]
    [InlineData("ASPNETCORE_")]
    public async Task The_api_refuses_to_start_when_a_prefixed_inherited_signing_key_reaches_it(string prefix)
    {
        var settings = server.StartupSettings();
        settings.Remove("Authentication__Jwt__SigningKey");

        var variable = $"{prefix}Authentication__Jwt__SigningKey";
        var previous = Environment.GetEnvironmentVariable(variable);
        Environment.SetEnvironmentVariable(variable, "inherited-prefixed-signing-key-0123456789");

        try
        {
            await using var process = await ApiServerProcess.StartAsync(
                "Production",
                settings,
                removeFromEnvironment: ["Authentication__Jwt__SigningKey"]);
            await process.WaitForExitAsync(TimeSpan.FromSeconds(20));

            Assert.NotEqual(0, process.ExitCode);
            Assert.Contains("Authentication:Jwt:SigningKey is required outside development", process.CapturedOutput);
        }
        finally
        {
            Environment.SetEnvironmentVariable(variable, previous);
        }
    }
}
