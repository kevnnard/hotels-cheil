using HotelManagement.Infrastructure.Storage;
using Microsoft.Extensions.Logging;

namespace HotelManagement.Infrastructure.Tests.Storage;

public sealed class LocalFileStorageServiceTests : IDisposable
{
    private const string Key = "0123456789abcdef0123456789abcdef.png";
    private const string OtherKey = "fedcba9876543210fedcba9876543210.webp";

    private readonly string workspace = Path.Combine(Path.GetTempPath(), "hotel-storage-tests", Guid.NewGuid().ToString("N"));
    private readonly CollectingLogger<LocalFileStorageService> logger = new();

    private string Root => Path.Combine(workspace, "images");

    private LocalFileStorageService Service => new(new ImageStorageOptions { RootPath = Root }, logger);

    public void Dispose()
    {
        if (Directory.Exists(workspace))
        {
            SetPermissions(Root, UnixFileMode.UserRead | UnixFileMode.UserWrite | UnixFileMode.UserExecute);
            Directory.Delete(workspace, recursive: true);
        }
    }

    private static void SetPermissions(string path, UnixFileMode mode)
    {
        if (!OperatingSystem.IsWindows() && Directory.Exists(path))
        {
            File.SetUnixFileMode(path, mode);
        }
    }

    private static byte[] Bytes(params byte[] values) => values;

    private static async Task<byte[]> ReadAsync(Stream stream)
    {
        await using (stream)
        {
            using var copy = new MemoryStream();
            await stream.CopyToAsync(copy);
            return copy.ToArray();
        }
    }

    private string[] FilesUnderRoot() =>
        Directory.Exists(Root) ? Directory.GetFiles(Root, "*", SearchOption.AllDirectories) : [];

    [Fact]
    public async Task A_saved_file_is_read_back_unchanged_and_leaves_no_staging_files()
    {
        byte[] content = [1, 2, 3, 4, 5, 250];

        await Service.SaveAsync(Key, content, CancellationToken.None);

        Assert.Equal(content, await ReadAsync((await Service.OpenReadAsync(Key, CancellationToken.None))!));
        Assert.Equal([Path.Combine(Root, Key)], FilesUnderRoot());
    }

    [Fact]
    public async Task Saving_an_existing_key_fails_and_keeps_the_original_bytes()
    {
        await Service.SaveAsync(Key, Bytes(1, 1, 1), CancellationToken.None);

        await Assert.ThrowsAsync<IOException>(() => Service.SaveAsync(Key, Bytes(2, 2, 2), CancellationToken.None));

        Assert.Equal([1, 1, 1], await ReadAsync((await Service.OpenReadAsync(Key, CancellationToken.None))!));
        Assert.Single(FilesUnderRoot());
    }

    [Fact]
    public async Task Concurrent_saves_to_the_same_key_leave_exactly_one_complete_winner()
    {
        var attempts = Enumerable.Range(1, 8)
            .Select(index => Service.SaveAsync(Key, Enumerable.Repeat((byte)index, 50_000).ToArray(), CancellationToken.None))
            .ToArray();

        await Task.WhenAll(attempts.Select(async attempt =>
        {
            try
            {
                await attempt;
            }
            catch (IOException)
            {
            }
        }));

        var winners = attempts.Count(attempt => attempt.IsCompletedSuccessfully);
        var stored = await ReadAsync((await Service.OpenReadAsync(Key, CancellationToken.None))!);
        Assert.Equal(1, winners);
        Assert.Equal(50_000, stored.Length);
        Assert.Single(stored.Distinct());
        Assert.Single(FilesUnderRoot());
    }

    [Fact]
    public async Task A_cancelled_save_leaves_neither_the_file_nor_staging_leftovers()
    {
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => Service.SaveAsync(Key, Bytes(1, 2, 3), cancellation.Token));

        Assert.Empty(FilesUnderRoot());
        Assert.Null(await Service.OpenReadAsync(Key, CancellationToken.None));
    }

    [Fact]
    public async Task A_save_that_cannot_write_leaves_nothing_behind()
    {
        if (OperatingSystem.IsWindows())
        {
            return;
        }

        Directory.CreateDirectory(Root);
        var service = Service;
        SetPermissions(Root, UnixFileMode.UserRead | UnixFileMode.UserExecute);

        await Assert.ThrowsAnyAsync<Exception>(() => service.SaveAsync(Key, Bytes(1, 2, 3), CancellationToken.None));

        Assert.Empty(FilesUnderRoot());
    }

    [Theory]
    [InlineData("../escape.png")]
    [InlineData("nested/0123456789abcdef0123456789abcdef.png")]
    [InlineData("..\\0123456789abcdef0123456789abcdef.png")]
    [InlineData("/etc/passwd")]
    [InlineData("0123456789ABCDEF0123456789ABCDEF.png")]
    [InlineData("0123456789abcdef0123456789abcdef.gif")]
    [InlineData("0123456789abcdef0123456789abcdef")]
    [InlineData("short.png")]
    [InlineData("")]
    public async Task Keys_that_are_not_generated_identifiers_never_reach_the_filesystem(string key)
    {
        var canary = Path.Combine(workspace, "escape.png");
        Directory.CreateDirectory(workspace);
        await File.WriteAllBytesAsync(canary, [9, 9, 9]);

        await Assert.ThrowsAsync<ArgumentException>(() => Service.SaveAsync(key, Bytes(1, 2, 3), CancellationToken.None));
        Assert.Null(await Service.OpenReadAsync(key, CancellationToken.None));
        await Service.DeleteAsync(key);

        Assert.Equal([9, 9, 9], await File.ReadAllBytesAsync(canary));
        Assert.Equal([canary], Directory.GetFiles(workspace, "*", SearchOption.AllDirectories));
    }

    [Fact]
    public async Task Deleting_removes_only_the_requested_file_and_is_idempotent()
    {
        await Service.SaveAsync(Key, Bytes(1), CancellationToken.None);
        await Service.SaveAsync(OtherKey, Bytes(2), CancellationToken.None);

        await Service.DeleteAsync(Key);
        await Service.DeleteAsync(Key);

        Assert.Null(await Service.OpenReadAsync(Key, CancellationToken.None));
        Assert.Equal([2], await ReadAsync((await Service.OpenReadAsync(OtherKey, CancellationToken.None))!));
        Assert.Empty(logger.Entries);
    }

    [Fact]
    public async Task A_delete_that_fails_is_reported_in_the_log_without_throwing_or_exposing_the_path()
    {
        Directory.CreateDirectory(Path.Combine(Root, Key));

        await Service.DeleteAsync(Key);

        Assert.True(Directory.Exists(Path.Combine(Root, Key)));
        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains(Key, entry.Message);
        Assert.DoesNotContain(workspace, entry.Message);
    }

    [Fact]
    public async Task Reading_a_missing_key_returns_null()
    {
        Assert.Null(await Service.OpenReadAsync(Key, CancellationToken.None));
    }

    [Fact]
    public async Task A_reader_keeps_a_complete_stream_even_when_the_file_is_deleted_meanwhile()
    {
        var content = Enumerable.Range(0, 100_000).Select(index => (byte)index).ToArray();
        await Service.SaveAsync(Key, content, CancellationToken.None);
        var stream = (await Service.OpenReadAsync(Key, CancellationToken.None))!;

        await Service.DeleteAsync(Key);

        Assert.Equal(content, await ReadAsync(stream));
    }
}
