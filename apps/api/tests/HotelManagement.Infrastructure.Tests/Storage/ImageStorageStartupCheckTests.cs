using HotelManagement.Infrastructure.Storage;

namespace HotelManagement.Infrastructure.Tests.Storage;

public sealed class ImageStorageStartupCheckTests : IDisposable
{
    private readonly string workspace = Path.Combine(Path.GetTempPath(), "hotel-startup-tests", Guid.NewGuid().ToString("N"));

    public void Dispose()
    {
        if (Directory.Exists(workspace))
        {
            if (!OperatingSystem.IsWindows())
            {
                File.SetUnixFileMode(workspace, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            }

            Directory.Delete(workspace, recursive: true);
        }
    }

    [Fact]
    public async Task Starting_creates_the_writable_root_and_leaves_it_empty_of_files()
    {
        var root = Path.Combine(workspace, "images");

        await new ImageStorageStartupCheck(new ImageStorageOptions { RootPath = root }).StartAsync(CancellationToken.None);

        Assert.True(Directory.Exists(root));
        Assert.Empty(Directory.GetFiles(root, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Starting_fails_fast_when_the_root_is_not_writable()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        Directory.CreateDirectory(workspace);
        File.SetUnixFileMode(workspace, UnixFileMode.UserRead | UnixFileMode.UserExecute);
        var check = new ImageStorageStartupCheck(new ImageStorageOptions { RootPath = Path.Combine(workspace, "images") });

        var failure = await Assert.ThrowsAsync<InvalidOperationException>(() => check.StartAsync(CancellationToken.None));

        Assert.Contains("Storage:Images:RootPath", failure.Message);
    }
}
