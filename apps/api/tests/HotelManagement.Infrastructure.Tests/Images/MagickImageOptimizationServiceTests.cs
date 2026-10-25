using HotelManagement.Application.Images;
using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Images;
using HotelManagement.TestSupport.Images;

namespace HotelManagement.Infrastructure.Tests.Images;

public class MagickImageOptimizationServiceTests
{
    private static readonly MagickImageOptimizationService Service = new();

    private static async Task<ImageOptimizationOutcome> OptimizeAsync(byte[] source) =>
        await Service.OptimizeAsync(source, CancellationToken.None);

    private static OptimizedImage Accepted(ImageOptimizationOutcome outcome)
    {
        Assert.True(outcome.IsAccepted, outcome.Message);
        Assert.NotNull(outcome.Image);
        Assert.InRange(outcome.Image.Content.Length, 1, HotelImage.MaximumBytes);
        return outcome.Image;
    }

    private static void AssertSamePixels(RgbaImage expected, byte[] actualContent)
    {
        var actual = TestImages.Decode(actualContent);
        Assert.Equal(expected.Width, actual.Width);
        Assert.Equal(expected.Height, actual.Height);
        Assert.True(expected.Samples.AsSpan().SequenceEqual(actual.Samples), "Decoded samples differ from the source.");
    }

    private static void AssertRejected(ImageOptimizationOutcome outcome, ImageRejection expected)
    {
        Assert.False(outcome.IsAccepted);
        Assert.Null(outcome.Image);
        Assert.Equal(expected, outcome.Rejection);
        Assert.False(string.IsNullOrWhiteSpace(outcome.Message));
    }

    [Fact]
    public async Task A_png_already_within_the_budget_is_kept_byte_for_byte_with_sixteen_bit_precision_and_transparent_rgb()
    {
        var source = RgbaImage.Noise(48, 32, 1, sixteenBit: true, transparentRgb: true);
        var png = TestImages.Png(source, depth: 16);

        var result = Accepted(await OptimizeAsync(png));

        Assert.Equal(png, result.Content);
        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal((48, 32), (result.Width, result.Height));
        AssertSamePixels(source, result.Content);
    }

    [Theory]
    [InlineData("jpeg", HotelImage.Jpeg)]
    [InlineData("webp", HotelImage.WebP)]
    public async Task A_jpeg_or_webp_within_the_budget_is_kept_byte_for_byte(string kind, string contentType)
    {
        var source = RgbaImage.Gradient(120, 80);
        var content = kind == "jpeg" ? TestImages.Jpeg(source) : TestImages.WebP(source);

        var result = Accepted(await OptimizeAsync(content));

        Assert.Equal(content, result.Content);
        Assert.Equal(contentType, result.ContentType);
        Assert.Equal((120, 80), (result.Width, result.Height));
    }

    [Fact]
    public async Task A_compressible_png_above_the_budget_is_recompressed_losslessly_without_changing_pixels_or_dimensions()
    {
        var source = RgbaImage.Gradient(400, 400);
        var heavy = TestImages.Png(source, compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal((400, 400), (result.Width, result.Height));
        AssertSamePixels(source, result.Content);
    }

    [Fact]
    public async Task Transparent_pixels_keep_their_hidden_rgb_values_after_recompression()
    {
        var source = RgbaImage.Gradient(400, 400, transparentRgb: true);
        var heavy = TestImages.Png(source, compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var result = Accepted(await OptimizeAsync(heavy));

        AssertSamePixels(source, result.Content);
        Assert.Contains(source.Samples.Chunk(4), pixel => pixel[3] == 0 && (pixel[0] | pixel[1] | pixel[2]) != 0);
    }

    [Fact]
    public async Task Sixteen_bit_samples_survive_recompression_and_are_never_routed_through_an_eight_bit_encoder()
    {
        var source = RgbaImage.Gradient(300, 300, sixteenBit: true, transparentRgb: true);
        var heavy = TestImages.Png(source, depth: 16, compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal(HotelImage.Png, result.ContentType);
        AssertSamePixels(source, result.Content);
        Assert.Contains(source.Samples, sample => sample % 257 != 0);
    }

    [Fact]
    public async Task Color_profile_and_orientation_are_preserved_when_the_image_is_recompressed()
    {
        var source = RgbaImage.Gradient(400, 400);
        var heavy = TestImages.Png(source, compressionLevel: 0, withProfile: true, orientation: 6);
        var expected = TestImages.Decode(heavy);
        Assert.NotNull(expected.IccProfile);
        Assert.Equal(6, expected.Orientation);

        var result = Accepted(await OptimizeAsync(heavy));

        var actual = TestImages.Decode(result.Content);
        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(expected.IccProfile, actual.IccProfile);
        Assert.Equal(6, actual.Orientation);
        Assert.True(expected.Samples.AsSpan().SequenceEqual(actual.Samples));
        Assert.Equal((400, 400), (actual.Width, actual.Height));
    }

    [Fact]
    public async Task A_declared_gamma_is_never_dropped_by_a_candidate_that_cannot_carry_it()
    {
        var source = RgbaImage.Gradient(400, 400);
        var heavy = PngBytes.WithGamma(PngBytes.WithoutChunk(TestImages.Png(source, compressionLevel: 0), "cHRM"), 50_000);
        var expected = TestImages.Decode(heavy);
        Assert.Equal(0.5, expected.Gamma);

        var result = Accepted(await OptimizeAsync(heavy));

        var actual = TestImages.Decode(result.Content);
        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(0.5, actual.Gamma);
        Assert.True(expected.Samples.AsSpan().SequenceEqual(actual.Samples));
    }

    private static readonly byte[] Bt2020PqIdentityFullRange = [9, 16, 0, 1];

    [Fact]
    public async Task Declared_coding_independent_color_is_kept_by_the_recompressed_png_and_never_dropped_by_webp()
    {
        var source = RgbaImage.Gradient(400, 400);
        var heavy = PngBytes.WithChunk(TestImages.Png(source, compressionLevel: 0), "cICP", Bt2020PqIdentityFullRange);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(Bt2020PqIdentityFullRange, PngBytes.ChunkData(result.Content, "cICP"));
        AssertSamePixels(source, result.Content);
    }

    [Fact]
    public async Task An_opaque_gray_ramp_with_declared_color_is_kept_as_a_png_with_the_same_declaration()
    {
        var heavy = PngBytes.OpaqueGrayRamp(400, 400, ("cICP", Bt2020PqIdentityFullRange));
        Assert.True(heavy.Length > HotelImage.MaximumBytes);
        var expected = TestImages.Decode(heavy);

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(Bt2020PqIdentityFullRange, PngBytes.ChunkData(result.Content, "cICP"));
        Assert.True(expected.Samples.AsSpan().SequenceEqual(TestImages.Decode(result.Content).Samples));
    }

    [Fact]
    public async Task A_declared_srgb_intent_is_kept_byte_for_byte_by_the_recompressed_png()
    {
        byte[] relativeColorimetric = [1];
        var heavy = PngBytes.OpaqueGrayRamp(400, 400, ("sRGB", relativeColorimetric));

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(relativeColorimetric, PngBytes.ChunkData(result.Content, "sRGB"));
    }

    [Fact]
    public async Task A_png_within_the_budget_that_declares_color_is_retained_with_its_declaration()
    {
        var png = PngBytes.WithChunk(TestImages.Png(RgbaImage.Noise(24, 24, 3)), "cICP", Bt2020PqIdentityFullRange);

        var result = Accepted(await OptimizeAsync(png));

        Assert.Equal(png, result.Content);
        Assert.Equal(Bt2020PqIdentityFullRange, PngBytes.ChunkData(result.Content, "cICP"));
    }

    [Theory]
    [InlineData("IEND")]
    [InlineData("IDAT")]
    [InlineData("IHDR")]
    [InlineData("tEXt")]
    public async Task A_png_with_a_failing_chunk_checksum_is_rejected_as_corrupt(string chunk)
    {
        var valid = PngBytes.WithChunk(TestImages.Png(RgbaImage.Gradient(3, 2)), "tEXt", "k\0v"u8.ToArray());

        AssertRejected(await OptimizeAsync(PngBytes.WithCorruptedCrc(valid, chunk)), ImageRejection.Corrupt);
    }

    [Fact]
    public async Task The_final_byte_of_a_png_cannot_be_flipped_without_rejection_even_above_the_budget()
    {
        var heavy = TestImages.Png(RgbaImage.Gradient(400, 400), compressionLevel: 0);
        heavy[^1] ^= 0xFF;

        AssertRejected(await OptimizeAsync(heavy), ImageRejection.Corrupt);
    }

    [Fact]
    public async Task A_linear_light_png_is_rejected_as_an_unsupported_representation()
    {
        var linear = PngBytes.WithGamma(TestImages.Png(RgbaImage.Gradient(64, 64)), 100_000);

        AssertRejected(await OptimizeAsync(linear), ImageRejection.UnsupportedRepresentation);
    }

    [Fact]
    public async Task Declared_chromaticities_are_kept_byte_for_byte_and_never_routed_through_webp()
    {
        var heavy = PngBytes.WithChromaticities(TestImages.Png(RgbaImage.Gradient(400, 400), compressionLevel: 0));
        var expected = PngBytes.ChunkData(heavy, "cHRM");
        Assert.NotNull(expected);

        var result = Accepted(await OptimizeAsync(heavy));

        Assert.Equal(HotelImage.Png, result.ContentType);
        Assert.Equal(expected, PngBytes.ChunkData(result.Content, "cHRM"));
    }

    [Fact]
    public async Task A_grayscale_png_above_the_budget_is_recompressed_without_changing_its_pixels()
    {
        var heavy = TestImages.GrayPng(RgbaImage.Gradient(700, 700), compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);
        var expected = TestImages.Decode(heavy);

        var result = Accepted(await OptimizeAsync(heavy));

        var actual = TestImages.Decode(result.Content);
        Assert.True(expected.Samples.AsSpan().SequenceEqual(actual.Samples));
        Assert.Equal((700, 700), (actual.Width, actual.Height));
    }

    [Fact]
    public async Task A_png_exactly_at_the_byte_budget_is_kept_and_one_byte_above_is_recompressed_not_padded_or_rejected()
    {
        var source = RgbaImage.Noise(40, 30, 3);
        var small = TestImages.Png(source);
        var atBudget = PngBytes.WithTotalSize(small, HotelImage.MaximumBytes);
        var aboveBudget = PngBytes.WithTotalSize(small, HotelImage.MaximumBytes + 1);

        var kept = Accepted(await OptimizeAsync(atBudget));
        var recompressed = Accepted(await OptimizeAsync(aboveBudget));

        Assert.Equal(HotelImage.MaximumBytes, kept.Content.Length);
        Assert.Equal(atBudget, kept.Content);
        Assert.True(recompressed.Content.Length < HotelImage.MaximumBytes);
        AssertSamePixels(source, recompressed.Content);
    }

    [Fact]
    public async Task Noise_that_cannot_fit_losslessly_is_rejected_instead_of_degraded()
    {
        var png = TestImages.Png(RgbaImage.Noise(500, 500, 7), compressionLevel: 9);
        Assert.True(png.Length > HotelImage.MaximumBytes);

        AssertRejected(await OptimizeAsync(png), ImageRejection.ExceedsByteBudget);
    }

    [Fact]
    public async Task A_jpeg_whose_decoded_pixels_cannot_fit_losslessly_is_rejected()
    {
        var jpeg = TestImages.Jpeg(RgbaImage.Noise(600, 600, 9), quality: 100);
        Assert.True(jpeg.Length > HotelImage.MaximumBytes);

        AssertRejected(await OptimizeAsync(jpeg), ImageRejection.ExceedsByteBudget);
    }

    [Fact]
    public async Task The_declared_format_is_decided_by_the_content_not_the_caller()
    {
        var source = RgbaImage.Gradient(60, 40);

        var result = Accepted(await OptimizeAsync(TestImages.Jpeg(source)));

        Assert.Equal(HotelImage.Jpeg, result.ContentType);
    }

    public static TheoryData<string, byte[], ImageRejection> UnacceptableContent => new()
    {
        { "random bytes", [.. Enumerable.Range(0, 2048).Select(index => (byte)(index * 31 + 7))], ImageRejection.UnsupportedFormat },
        { "gif", TestImages.Gif(), ImageRejection.UnsupportedFormat },
        { "svg text", "<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10'><rect width='10' height='10'/></svg>"u8.ToArray(), ImageRejection.UnsupportedFormat },
        { "pdf header", "%PDF-1.4\n1 0 obj\n<<>>\nendobj\n"u8.ToArray(), ImageRejection.UnsupportedFormat },
        { "url reference", "https://example.com/image.png"u8.ToArray(), ImageRejection.UnsupportedFormat },
        { "file reference", "@/etc/passwd"u8.ToArray(), ImageRejection.UnsupportedFormat },
        { "png signature with garbage", [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], ImageRejection.Corrupt },
        { "jpeg signature with garbage", [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], ImageRejection.Corrupt },
        { "webp riff with garbage", [.. "RIFF"u8.ToArray(), 0x20, 0, 0, 0, .. "WEBP"u8.ToArray(), 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], ImageRejection.Corrupt }
    };

    [Theory]
    [MemberData(nameof(UnacceptableContent))]
    public async Task Content_that_is_not_a_real_static_jpeg_png_or_webp_is_rejected(string label, byte[] content, ImageRejection expected)
    {
        Assert.NotEmpty(label);

        AssertRejected(await OptimizeAsync(content), expected);
    }

    [Fact]
    public async Task Empty_content_is_rejected()
    {
        AssertRejected(await OptimizeAsync([]), ImageRejection.Empty);
    }

    [Theory]
    [InlineData("png")]
    [InlineData("jpeg")]
    [InlineData("webp")]
    public async Task Truncated_files_are_rejected_as_corrupt(string kind)
    {
        var source = RgbaImage.Gradient(200, 200);
        var whole = kind switch
        {
            "png" => TestImages.Png(source),
            "jpeg" => TestImages.Jpeg(source),
            _ => TestImages.WebP(source)
        };

        AssertRejected(await OptimizeAsync(whole[..(whole.Length / 2)]), ImageRejection.Corrupt);
    }

    [Fact]
    public async Task Animated_webp_and_apng_are_rejected()
    {
        var first = RgbaImage.Gradient(32, 32);
        var second = RgbaImage.Noise(32, 32, 4);

        AssertRejected(await OptimizeAsync(TestImages.AnimatedWebP(first, second)), ImageRejection.Animated);
        AssertRejected(await OptimizeAsync(PngBytes.Animated(TestImages.Png(first))), ImageRejection.Animated);
    }

    [Fact]
    public async Task Images_beyond_four_thousand_ninety_six_pixels_on_an_axis_are_rejected()
    {
        AssertRejected(await OptimizeAsync(PngBytes.Declaring(4097, 1)), ImageRejection.DimensionsExceeded);
        AssertRejected(await OptimizeAsync(PngBytes.Declaring(1, 4097)), ImageRejection.DimensionsExceeded);
        AssertRejected(await OptimizeAsync(PngBytes.Declaring(8192, 2048)), ImageRejection.DimensionsExceeded);
    }

    [Fact]
    public async Task Jpeg_and_webp_headers_declaring_too_many_pixels_are_rejected()
    {
        var source = RgbaImage.Gradient(48, 48);

        AssertRejected(await OptimizeAsync(ContainerBytes.JpegDeclaring(TestImages.Jpeg(source), 4097, 8)), ImageRejection.DimensionsExceeded);
        AssertRejected(await OptimizeAsync(ContainerBytes.WebPDeclaring(TestImages.WebP(source), 4097, 8)), ImageRejection.DimensionsExceeded);
    }

    [Fact]
    public async Task A_tiny_file_declaring_a_huge_canvas_is_rejected_before_decoding_pixels()
    {
        var bomb = PngBytes.Declaring(60_000, 60_000);
        Assert.True(bomb.Length < 200);

        AssertRejected(await OptimizeAsync(bomb), ImageRejection.DimensionsExceeded);
    }

    [Fact]
    public async Task A_picture_at_the_maximum_pixel_count_is_accepted_when_it_compresses_into_the_budget()
    {
        var source = RgbaImage.Gradient(4096, 4096);
        var png = TestImages.Png(source);
        Assert.True(png.Length <= HotelImage.MaximumBytes, "Fixture must fit the budget.");

        var result = Accepted(await OptimizeAsync(png));

        Assert.Equal((4096, 4096), (result.Width, result.Height));
        Assert.Equal(png, result.Content);
    }

    [Fact]
    public async Task Cmyk_jpeg_is_rejected_because_converting_it_would_change_the_pixels()
    {
        var cmyk = TestImages.CmykJpeg(RgbaImage.Gradient(64, 64));

        AssertRejected(await OptimizeAsync(cmyk), ImageRejection.UnsupportedRepresentation);
    }

    [Fact]
    public async Task Concurrent_uploads_all_complete_with_their_own_results()
    {
        var sources = Enumerable.Range(0, 6).Select(seed => RgbaImage.Noise(30 + seed, 20, seed)).ToArray();

        var outcomes = await Task.WhenAll(sources.Select(source => OptimizeAsync(TestImages.Png(source))));

        for (var index = 0; index < sources.Length; index++)
        {
            AssertSamePixels(sources[index], Accepted(outcomes[index]).Content);
        }
    }

    [Fact]
    public async Task A_cancelled_request_does_not_produce_a_result()
    {
        using var cancellation = new CancellationTokenSource();
        await cancellation.CancelAsync();

        await Assert.ThrowsAnyAsync<OperationCanceledException>(
            () => Service.OptimizeAsync(TestImages.Png(RgbaImage.Gradient(16, 16)), cancellation.Token));
    }
}
