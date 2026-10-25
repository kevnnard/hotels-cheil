using HotelManagement.Application.Images;
using ImageMagick;
using ImageMagick.Configuration;

namespace HotelManagement.Infrastructure.Images;

public static class MagickRuntime
{
    static MagickRuntime()
    {
        var files = ConfigurationFiles.Default;
        files.Policy.Data = BuildPolicy();
        MagickNET.Initialize(files);
    }

    public static void EnsureConfigured()
    {
    }

    private static string BuildPolicy() => $$"""
        <?xml version="1.0" encoding="UTF-8"?>
        <policymap>
          <policy domain="resource" name="width" value="{{ImageLimits.MaximumDimension}}"/>
          <policy domain="resource" name="height" value="{{ImageLimits.MaximumDimension}}"/>
          <policy domain="resource" name="area" value="{{ImageLimits.MaximumPixels}}"/>
          <policy domain="resource" name="memory" value="512MiB"/>
          <policy domain="resource" name="map" value="1GiB"/>
          <policy domain="resource" name="disk" value="1GiB"/>
          <policy domain="resource" name="time" value="60"/>
          <policy domain="resource" name="thread" value="2"/>
          <policy domain="delegate" rights="none" pattern="*"/>
          <policy domain="filter" rights="none" pattern="*"/>
          <policy domain="coder" rights="none" pattern="*"/>
          <policy domain="coder" rights="read|write" pattern="{PNG,JPEG,WEBP}"/>
          <policy domain="path" rights="none" pattern="@*"/>
          <policy domain="path" rights="none" pattern="|*"/>
        </policymap>
        """;
}
