using HotelManagement.Application.Images;
using HotelManagement.Domain.Hotels;
using ImageMagick;

namespace HotelManagement.Infrastructure.Images;

public sealed class MagickImageOptimizationService : IImageOptimizationService
{
    private const int ConcurrentOptimizations = 2;
    private const int ComparisonBlockPixels = 1_000_000;
    private const int LargeImagePixels = 4_000_000;
    private const int MaximumLosslessEffort = 100;
    private static readonly string[] PreservedColorChunks = ["cHRM", "sRGB", "cICP", "mDCV", "cLLI"];
    private static readonly string[] PngStrategies = ["1", "0"];
    private static readonly string[] PngStrategiesForLargeImages = ["1"];
    private static readonly SemaphoreSlim Gate = new(ConcurrentOptimizations);

    static MagickImageOptimizationService()
    {
        MagickRuntime.EnsureConfigured();
    }

    public async Task<ImageOptimizationOutcome> OptimizeAsync(ReadOnlyMemory<byte> source, CancellationToken cancellationToken)
    {
        if (source.IsEmpty)
        {
            return ImageOptimizationOutcome.Rejected(ImageRejection.Empty, "The image is empty.");
        }

        await Gate.WaitAsync(cancellationToken);
        try
        {
            var content = source.ToArray();
            return await Task.Run(() => Optimize(content, cancellationToken), cancellationToken);
        }
        finally
        {
            Gate.Release();
        }
    }

    private static ImageOptimizationOutcome Optimize(byte[] content, CancellationToken cancellationToken)
    {
        if (ImageFormatDetector.Detect(content) is not { } kind)
        {
            return ImageOptimizationOutcome.Rejected(ImageRejection.UnsupportedFormat, "Only static JPEG, PNG and WebP images are accepted.");
        }

        if (kind == ImageKind.Png && !PngChunks.IsIntact(content))
        {
            return ImageOptimizationOutcome.Rejected(ImageRejection.Corrupt, "The PNG data is damaged or incomplete.");
        }

        if (ImageFormatDetector.IsAnimated(kind, content))
        {
            return ImageOptimizationOutcome.Rejected(ImageRejection.Animated, "Animated images are not accepted.");
        }

        if (ImageHeaderReader.TryReadDimensions(kind, content, out var declaredWidth, out var declaredHeight) && ExceedsLimits(declaredWidth, declaredHeight))
        {
            return DimensionsExceeded();
        }

        var settings = new MagickReadSettings { Format = FormatOf(kind) };
        if (Inspect(content, settings) is { } rejection)
        {
            return rejection;
        }

        using var image = new MagickImage();
        var warnings = 0;
        image.Warning += (_, _) => warnings++;
        try
        {
            image.Read(content, settings);
        }
        catch (MagickException exception)
        {
            return Classify(exception);
        }

        if (kind == ImageKind.Jpeg && warnings > 0)
        {
            return ImageOptimizationOutcome.Rejected(ImageRejection.Corrupt, "The JPEG data is damaged.");
        }

        if (image.ColorSpace is not (ColorSpace.sRGB or ColorSpace.Gray))
        {
            return ImageOptimizationOutcome.Rejected(
                ImageRejection.UnsupportedRepresentation,
                "Only sRGB and grayscale images can be kept without changing their pixels.");
        }

        var width = (int)image.Width;
        var height = (int)image.Height;
        if (content.Length <= HotelImage.MaximumBytes)
        {
            return ImageOptimizationOutcome.Accepted(new OptimizedImage(content, ContentTypeOf(kind), width, height));
        }

        var colorChunks = kind == ImageKind.Png ? SourceColorChunks(content) : [];
        var best = SmallestLosslessCandidate(image, colorChunks, cancellationToken);
        return best is null
            ? ImageOptimizationOutcome.Rejected(
                ImageRejection.ExceedsByteBudget,
                $"The image cannot be kept within {HotelImage.MaximumBytes} bytes without losing quality.")
            : ImageOptimizationOutcome.Accepted(new OptimizedImage(best.Content, best.ContentType, width, height));
    }

    private static ImageOptimizationOutcome? Inspect(byte[] content, MagickReadSettings settings)
    {
        try
        {
            using var frames = new MagickImageCollection();
            frames.Ping(content, settings);
            if (frames.Count != 1)
            {
                return ImageOptimizationOutcome.Rejected(ImageRejection.Animated, "Animated images are not accepted.");
            }

            return ExceedsLimits(frames[0].Width, frames[0].Height) ? DimensionsExceeded() : null;
        }
        catch (MagickException exception)
        {
            return Classify(exception);
        }
    }

    private static bool ExceedsLimits(long width, long height) =>
        width > ImageLimits.MaximumDimension || height > ImageLimits.MaximumDimension || width * height > ImageLimits.MaximumPixels;

    private static ImageOptimizationOutcome DimensionsExceeded() =>
        ImageOptimizationOutcome.Rejected(
            ImageRejection.DimensionsExceeded,
            $"Images are limited to {ImageLimits.MaximumDimension} pixels per side and {ImageLimits.MaximumPixels} pixels.");

    private static ImageOptimizationOutcome Classify(MagickException exception) => exception switch
    {
        MagickResourceLimitErrorException or MagickPolicyErrorException or MagickCacheErrorException => DimensionsExceeded(),
        _ => ImageOptimizationOutcome.Rejected(ImageRejection.Corrupt, "The image data is damaged or incomplete.")
    };

    private static Candidate? SmallestLosslessCandidate(MagickImage source, IReadOnlyDictionary<string, byte[]> colorChunks, CancellationToken cancellationToken)
    {
        Candidate? best = null;
        foreach (var encoder in LosslessEncoders(source))
        {
            cancellationToken.ThrowIfCancellationRequested();
            var candidate = TryEncode(source, encoder, colorChunks);
            if (candidate is not null && (best is null || candidate.Content.Length < best.Content.Length))
            {
                best = candidate;
            }
        }

        return best;
    }

    private static IEnumerable<LosslessEncoder> LosslessEncoders(MagickImage source)
    {
        if (source.Depth <= 8)
        {
            yield return new LosslessEncoder(MagickFormat.WebP, HotelImage.WebP, image =>
            {
                image.Quality = MaximumLosslessEffort;
                image.Settings.SetDefine(MagickFormat.WebP, "lossless", "true");
                image.Settings.SetDefine(MagickFormat.WebP, "exact", "true");
                image.Settings.SetDefine(MagickFormat.WebP, "method", source.Width * source.Height > LargeImagePixels ? "4" : "6");
            });
        }

        var strategies = source.Width * source.Height > LargeImagePixels ? PngStrategiesForLargeImages : PngStrategies;
        foreach (var strategy in strategies)
        {
            yield return new LosslessEncoder(MagickFormat.Png, HotelImage.Png, image =>
            {
                image.Settings.SetDefine(MagickFormat.Png, "compression-level", "9");
                image.Settings.SetDefine(MagickFormat.Png, "compression-filter", "5");
                image.Settings.SetDefine(MagickFormat.Png, "compression-strategy", strategy);
            });
        }
    }

    private static Candidate? TryEncode(MagickImage source, LosslessEncoder encoder, IReadOnlyDictionary<string, byte[]> colorChunks)
    {
        try
        {
            using var clone = new MagickImage(source);
            encoder.Configure(clone);
            var content = WithColorChunks(clone.ToByteArray(encoder.Format), encoder.Format, colorChunks);
            return content.Length <= HotelImage.MaximumBytes
                && KeepsColorChunks(content, encoder.Format, colorChunks)
                && Reproduces(source, content, encoder.Format)
                ? new Candidate(content, encoder.ContentType)
                : null;
        }
        catch (MagickException)
        {
            return null;
        }
    }

    private static Dictionary<string, byte[]> SourceColorChunks(byte[] png)
    {
        var chunks = new Dictionary<string, byte[]>();
        foreach (var type in PreservedColorChunks)
        {
            if (PngChunks.Data(png, type) is { } data)
            {
                chunks[type] = data;
            }
        }

        return chunks;
    }

    private static byte[] WithColorChunks(byte[] candidate, MagickFormat format, IReadOnlyDictionary<string, byte[]> colorChunks)
    {
        if (format != MagickFormat.Png)
        {
            return candidate;
        }

        foreach (var (type, data) in colorChunks)
        {
            if (PngChunks.Data(candidate, type) is null)
            {
                candidate = PngChunks.InsertAfterHeader(candidate, type, data);
            }
        }

        return candidate;
    }

    private static bool KeepsColorChunks(byte[] candidate, MagickFormat format, IReadOnlyDictionary<string, byte[]> colorChunks) =>
        colorChunks.Count == 0
        || (format == MagickFormat.Png
            && colorChunks.All(chunk => chunk.Value.AsSpan().SequenceEqual(PngChunks.Data(candidate, chunk.Key))));

    private static bool Reproduces(MagickImage source, byte[] content, MagickFormat format)
    {
        using var decoded = new MagickImage();
        decoded.Read(content, new MagickReadSettings { Format = format });
        return decoded.Width == source.Width
            && decoded.Height == source.Height
            && decoded.Orientation == source.Orientation
            && decoded.ColorSpace is ColorSpace.sRGB or ColorSpace.Gray
            && ProfilesMatch(source, decoded)
            && ColorAttributesMatch(source, decoded)
            && PixelsMatch(source, decoded);
    }

    private static bool ProfilesMatch(MagickImage source, MagickImage decoded)
    {
        var expected = source.GetColorProfile()?.ToByteArray();
        var actual = decoded.GetColorProfile()?.ToByteArray();
        return expected is null ? actual is null : actual is not null && expected.AsSpan().SequenceEqual(actual);
    }

    private static bool ColorAttributesMatch(MagickImage source, MagickImage decoded) =>
        source.Gamma == decoded.Gamma;

    private static bool PixelsMatch(MagickImage source, MagickImage decoded)
    {
        var rowsPerBlock = (uint)Math.Max(1, ComparisonBlockPixels / (int)source.Width);
        using var expectedPixels = source.GetPixelsUnsafe();
        using var actualPixels = decoded.GetPixelsUnsafe();
        for (uint row = 0; row < source.Height; row += rowsPerBlock)
        {
            var rows = Math.Min(rowsPerBlock, source.Height - row);
            var expected = expectedPixels.ToShortArray(0, (int)row, source.Width, rows, PixelMapping.RGBA);
            var actual = actualPixels.ToShortArray(0, (int)row, decoded.Width, rows, PixelMapping.RGBA);
            if (expected is null || actual is null || !expected.AsSpan().SequenceEqual(actual))
            {
                return false;
            }
        }

        return true;
    }

    private static MagickFormat FormatOf(ImageKind kind) => kind switch
    {
        ImageKind.Png => MagickFormat.Png,
        ImageKind.Jpeg => MagickFormat.Jpeg,
        _ => MagickFormat.WebP
    };

    private static string ContentTypeOf(ImageKind kind) => kind switch
    {
        ImageKind.Png => HotelImage.Png,
        ImageKind.Jpeg => HotelImage.Jpeg,
        _ => HotelImage.WebP
    };

    private sealed record Candidate(byte[] Content, string ContentType);

    private sealed record LosslessEncoder(MagickFormat Format, string ContentType, Action<MagickImage> Configure);
}
