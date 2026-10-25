using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;

namespace HotelManagement.Infrastructure.Storage;

public sealed class ImageStorageOptions
{
    public const string SectionName = "Storage:Images";
    public const string RootPathSetting = SectionName + ":RootPath";

    public string RootPath { get; init; } = string.Empty;

    public static ImageStorageOptions Resolve(IConfiguration configuration, IHostEnvironment environment)
    {
        var configured = (configuration[RootPathSetting] ?? string.Empty).Trim();
        if (configured.Length == 0)
        {
            if (!environment.IsDevelopment())
            {
                throw new InvalidOperationException($"{RootPathSetting} is required outside development.");
            }

            configured = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "HotelManagement", "images");
        }

        if (!Path.IsPathFullyQualified(configured))
        {
            throw new InvalidOperationException($"{RootPathSetting} must be an absolute path.");
        }

        var root = Path.GetFullPath(configured);
        if (IsInside(environment.ContentRootPath, root))
        {
            throw new InvalidOperationException($"{RootPathSetting} must be outside the application content root.");
        }

        return new ImageStorageOptions { RootPath = root };
    }

    private static bool IsInside(string contentRoot, string path)
    {
        if (string.IsNullOrWhiteSpace(contentRoot))
        {
            return false;
        }

        var parent = Path.TrimEndingDirectorySeparator(Path.GetFullPath(contentRoot));
        return path.Equals(parent, StringComparison.Ordinal)
            || path.StartsWith(parent + Path.DirectorySeparatorChar, StringComparison.Ordinal);
    }
}
