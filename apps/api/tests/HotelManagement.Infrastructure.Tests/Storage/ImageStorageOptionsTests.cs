using HotelManagement.Infrastructure.Storage;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace HotelManagement.Infrastructure.Tests.Storage;

public class ImageStorageOptionsTests
{
    private static readonly string ContentRoot = Path.Combine(Path.GetTempPath(), "hotel-content-root");
    private static readonly string AbsoluteRoot = Path.Combine(Path.GetTempPath(), "hotel-images-elsewhere");

    private static IConfiguration Configuration(string? rootPath) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(rootPath is null ? [] : new Dictionary<string, string?> { ["Storage:Images:RootPath"] = rootPath })
            .Build();

    private static FakeEnvironment Environment(string name) => new(name, ContentRoot);

    [Fact]
    public void A_configured_absolute_path_is_trimmed_and_used()
    {
        var options = ImageStorageOptions.Resolve(Configuration($"  {AbsoluteRoot}  "), Environment(Environments.Production));

        Assert.Equal(AbsoluteRoot, options.RootPath);
    }

    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    [InlineData("Testing")]
    public void Outside_development_the_root_is_mandatory(string environment)
    {
        var failure = Assert.Throws<InvalidOperationException>(() => ImageStorageOptions.Resolve(Configuration(null), Environment(environment)));

        Assert.Contains("Storage:Images:RootPath", failure.Message);
    }

    [Fact]
    public void Development_defaults_to_a_per_user_directory_outside_the_content_root()
    {
        var options = ImageStorageOptions.Resolve(Configuration(" "), Environment(Environments.Development));

        Assert.True(Path.IsPathFullyQualified(options.RootPath));
        Assert.False(options.RootPath.StartsWith(ContentRoot, StringComparison.Ordinal));
        Assert.Contains("HotelManagement", options.RootPath);
    }

    [Theory]
    [InlineData("images")]
    [InlineData("./images")]
    [InlineData("../images")]
    public void A_relative_path_is_rejected(string path)
    {
        Assert.Throws<InvalidOperationException>(() => ImageStorageOptions.Resolve(Configuration(path), Environment(Environments.Production)));
    }

    [Theory]
    [InlineData("")]
    [InlineData("wwwroot")]
    [InlineData("images/nested")]
    public void A_path_inside_the_content_root_is_rejected(string relative)
    {
        var inside = Path.Combine(ContentRoot, relative);

        Assert.Throws<InvalidOperationException>(() => ImageStorageOptions.Resolve(Configuration(inside), Environment(Environments.Production)));
    }

    [Fact]
    public void A_sibling_whose_name_merely_starts_like_the_content_root_is_accepted()
    {
        var sibling = ContentRoot + "-images";

        Assert.Equal(sibling, ImageStorageOptions.Resolve(Configuration(sibling), Environment(Environments.Production)).RootPath);
    }

    private sealed class FakeEnvironment(string environmentName, string contentRootPath) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = environmentName;

        public string ApplicationName { get; set; } = "Tests";

        public string ContentRootPath { get; set; } = contentRootPath;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
