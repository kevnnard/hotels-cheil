using System.Text.RegularExpressions;
using HotelManagement.Application.Images;
using Microsoft.Extensions.Logging;

namespace HotelManagement.Infrastructure.Storage;

public sealed partial class LocalFileStorageService : IFileStorageService
{
    private const string StagingDirectoryName = ".staging";
    private const int BufferSize = 81_920;

    private readonly string root;
    private readonly string staging;
    private readonly ILogger<LocalFileStorageService> logger;

    public LocalFileStorageService(ImageStorageOptions options, ILogger<LocalFileStorageService> logger)
    {
        root = Path.GetFullPath(options.RootPath);
        staging = Path.Combine(root, StagingDirectoryName);
        this.logger = logger;
    }

    public async Task SaveAsync(string key, ReadOnlyMemory<byte> content, CancellationToken cancellationToken)
    {
        var destination = PathFor(key) ?? throw new ArgumentException("The storage key is not a generated image key.", nameof(key));
        Directory.CreateDirectory(staging);
        var temporary = Path.Combine(staging, $"{Guid.NewGuid():N}.part");
        try
        {
            await using (var file = new FileStream(temporary, FileMode.CreateNew, FileAccess.Write, FileShare.None, BufferSize, FileOptions.Asynchronous))
            {
                await file.WriteAsync(content, cancellationToken);
                file.Flush(flushToDisk: true);
            }

            File.Move(temporary, destination, overwrite: false);
        }
        catch
        {
            File.Delete(temporary);
            throw;
        }
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken)
    {
        var path = PathFor(key);
        if (path is null)
        {
            return Task.FromResult<Stream?>(null);
        }

        try
        {
            var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete, BufferSize, FileOptions.Asynchronous | FileOptions.SequentialScan);
            return Task.FromResult<Stream?>(stream);
        }
        catch (Exception exception) when (exception is FileNotFoundException or DirectoryNotFoundException)
        {
            return Task.FromResult<Stream?>(null);
        }
    }

    public Task DeleteAsync(string key)
    {
        var path = PathFor(key);
        if (path is null)
        {
            logger.LogWarning("Skipped deleting stored image {StorageKey}: the key is not a generated image key.", key);
            return Task.CompletedTask;
        }

        try
        {
            File.Delete(path);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            logger.LogWarning("Stored image {StorageKey} could not be deleted and remains as an orphan ({FailureType}).", key, exception.GetType().Name);
        }

        return Task.CompletedTask;
    }

    private string? PathFor(string key) => GeneratedKey().IsMatch(key) ? Path.Combine(root, key) : null;

    [GeneratedRegex("^[0-9a-f]{32}\\.(png|jpg|webp)$", RegexOptions.CultureInvariant)]
    private static partial Regex GeneratedKey();
}
