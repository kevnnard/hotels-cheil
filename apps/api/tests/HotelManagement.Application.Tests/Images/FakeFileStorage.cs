using HotelManagement.Application.Images;

namespace HotelManagement.Application.Tests.Images;

internal sealed class FakeFileStorage : IFileStorageService
{
    private readonly Dictionary<string, byte[]> files = [];

    public IReadOnlyCollection<string> Keys => files.Keys;

    public List<string> DeleteRequests { get; } = [];

    public HashSet<string> UndeletableKeys { get; } = [];

    public Exception? SaveFailure { get; set; }

    public byte[]? Content(string key) => files.GetValueOrDefault(key);

    public void Seed(string key, byte[] content) => files[key] = content;

    public Task SaveAsync(string key, ReadOnlyMemory<byte> content, CancellationToken cancellationToken)
    {
        if (SaveFailure is not null)
        {
            throw SaveFailure;
        }

        files.Add(key, content.ToArray());
        return Task.CompletedTask;
    }

    public Task<Stream?> OpenReadAsync(string key, CancellationToken cancellationToken) =>
        Task.FromResult<Stream?>(files.TryGetValue(key, out var content) ? new MemoryStream(content) : null);

    public Task DeleteAsync(string key)
    {
        DeleteRequests.Add(key);
        if (!UndeletableKeys.Contains(key))
        {
            files.Remove(key);
        }

        return Task.CompletedTask;
    }
}
