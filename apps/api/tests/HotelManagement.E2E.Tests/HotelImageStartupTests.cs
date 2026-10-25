namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class HotelImageStartupTests(HotelApiServerFixture server) : IDisposable
{
    private const string RootSetting = "Storage__Images__RootPath";

    private readonly string workspace = Path.Combine(Path.GetTempPath(), "hotel-e2e-startup", Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(workspace))
        {
            Directory.Delete(workspace, recursive: true);
        }
    }

    [Fact]
    public async Task The_api_refuses_to_start_without_an_image_storage_root()
    {
        var settings = server.StartupSettings();
        settings.Remove(RootSetting);

        await AssertStartupRefusedAsync(settings, "Storage:Images:RootPath is required outside development");
    }

    [Fact]
    public async Task The_api_refuses_to_start_with_a_relative_image_storage_root()
    {
        var settings = server.StartupSettings();
        settings[RootSetting] = "relative/images";

        await AssertStartupRefusedAsync(settings, "Storage:Images:RootPath must be an absolute path");
    }

    [Fact]
    public async Task The_api_refuses_to_start_when_the_image_storage_root_is_not_a_writable_directory()
    {
        Directory.CreateDirectory(workspace);
        var occupied = Path.Combine(workspace, "occupied");
        await File.WriteAllTextAsync(occupied, "not a directory");
        var settings = server.StartupSettings();
        settings[RootSetting] = occupied;

        await AssertStartupRefusedAsync(settings, "Storage:Images:RootPath is not a writable directory");
    }

    private static async Task AssertStartupRefusedAsync(Dictionary<string, string> settings, string expectedMessage)
    {
        await using var process = await ApiServerProcess.StartAsync("Production", settings, [RootSetting]);
        await process.WaitForExitAsync(TimeSpan.FromSeconds(30));

        Assert.NotEqual(0, process.ExitCode);
        Assert.Contains(expectedMessage, process.RawCapturedOutput);
    }
}
