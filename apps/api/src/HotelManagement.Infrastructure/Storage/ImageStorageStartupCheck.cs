using Microsoft.Extensions.Hosting;

namespace HotelManagement.Infrastructure.Storage;

public sealed class ImageStorageStartupCheck(ImageStorageOptions options) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        var probe = Path.Combine(options.RootPath, ".staging", $".probe-{Guid.NewGuid():N}");
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(probe)!);
            using (new FileStream(probe, FileMode.CreateNew, FileAccess.Write, FileShare.None, 1, FileOptions.DeleteOnClose))
            {
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            throw new InvalidOperationException($"{ImageStorageOptions.RootPathSetting} is not a writable directory.", exception);
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
