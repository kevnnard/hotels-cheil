using HotelManagement.Infrastructure.Images;
using ImageMagick;

namespace HotelManagement.TestSupport.Images;

public static class TestImages
{
    static TestImages()
    {
        MagickRuntime.EnsureConfigured();
    }

    public static byte[] Png(RgbaImage source, int depth = 8, int compressionLevel = 9, bool withProfile = false, int? orientation = null)
    {
        using var image = Create(source, depth);
        image.Settings.SetDefine(MagickFormat.Png, "compression-level", compressionLevel.ToString());
        Decorate(image, withProfile, orientation);
        return image.ToByteArray(MagickFormat.Png);
    }

    public static byte[] Jpeg(RgbaImage source, int quality = 90)
    {
        using var image = Create(source, 8);
        image.Alpha(AlphaAction.Off);
        image.Quality = (uint)quality;
        return image.ToByteArray(MagickFormat.Jpeg);
    }

    public static byte[] GrayPng(RgbaImage source, int compressionLevel = 9)
    {
        using var image = Create(source, 8);
        image.Alpha(AlphaAction.Off);
        image.ColorType = ColorType.Grayscale;
        image.Settings.SetDefine(MagickFormat.Png, "compression-level", compressionLevel.ToString());
        return image.ToByteArray(MagickFormat.Png);
    }

    public static byte[] CmykJpeg(RgbaImage source)
    {
        using var image = Create(source, 8);
        image.Alpha(AlphaAction.Off);
        image.ColorSpace = ColorSpace.CMYK;
        return image.ToByteArray(MagickFormat.Jpeg);
    }

    public static byte[] WebP(RgbaImage source, bool lossless = true)
    {
        using var image = Create(source, 8);
        image.Settings.SetDefine(MagickFormat.WebP, "lossless", lossless ? "true" : "false");
        image.Settings.SetDefine(MagickFormat.WebP, "exact", "true");
        return image.ToByteArray(MagickFormat.WebP);
    }

    public static byte[] AnimatedWebP(RgbaImage first, RgbaImage second)
    {
        using var frames = new MagickImageCollection();
        frames.Add(Create(first, 8));
        frames.Add(Create(second, 8));
        foreach (var frame in frames)
        {
            frame.AnimationDelay = 10;
        }

        using var output = new MemoryStream();
        frames.Write(output, MagickFormat.WebP);
        return output.ToArray();
    }

    public static byte[] Gif() => Convert.FromBase64String("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");

    public static DecodedImage Decode(byte[] content)
    {
        using var image = new MagickImage(content);
        return new DecodedImage(
            (int)image.Width,
            (int)image.Height,
            image.GetPixels().ToShortArray(PixelMapping.RGBA)!,
            image.GetColorProfile()?.ToByteArray(),
            (int)image.Orientation,
            image.Format.ToString(),
            image.Gamma);
    }

    public static byte[] AppleRgbProfile() => ColorProfiles.AppleRGB.ToByteArray();

    private static MagickImage Create(RgbaImage source, int depth)
    {
        var image = new MagickImage();
        image.ReadPixels(source.Samples, new PixelReadSettings((uint)source.Width, (uint)source.Height, StorageType.Quantum, PixelMapping.RGBA));
        image.Depth = (uint)depth;
        return image;
    }

    private static void Decorate(MagickImage image, bool withProfile, int? orientation)
    {
        if (withProfile)
        {
            image.SetProfile(ColorProfiles.AppleRGB);
        }

        if (orientation is { } value)
        {
            image.Orientation = (Orientation)value;
        }
    }
}
