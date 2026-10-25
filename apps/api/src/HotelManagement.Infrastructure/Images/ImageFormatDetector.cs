using System.Buffers.Binary;
using System.Text;

namespace HotelManagement.Infrastructure.Images;

internal enum ImageKind
{
    Png,
    Jpeg,
    WebP
}

internal static class ImageFormatDetector
{
    private static readonly byte[] PngSignature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private const int PngSignatureLength = 8;
    private const int RiffHeaderLength = 12;
    private const int ChunkHeaderLength = 8;
    private const byte WebPAnimationFlag = 0x02;

    public static ImageKind? Detect(ReadOnlySpan<byte> content)
    {
        if (content.StartsWith(PngSignature))
        {
            return ImageKind.Png;
        }

        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF)
        {
            return ImageKind.Jpeg;
        }

        if (content.Length >= RiffHeaderLength && content[..4].SequenceEqual("RIFF"u8) && content.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return ImageKind.WebP;
        }

        return null;
    }

    public static bool IsAnimated(ImageKind kind, ReadOnlySpan<byte> content) => kind switch
    {
        ImageKind.Png => PngChunks.Data(content, "acTL") is not null,
        ImageKind.WebP => WebPIsAnimated(content),
        _ => false
    };

    private static bool WebPIsAnimated(ReadOnlySpan<byte> content)
    {
        var position = RiffHeaderLength;
        while (position + ChunkHeaderLength <= content.Length)
        {
            var type = Encoding.ASCII.GetString(content.Slice(position, 4));
            var length = BinaryPrimitives.ReadUInt32LittleEndian(content.Slice(position + 4, 4));
            if (type == "ANIM" || type == "ANMF")
            {
                return true;
            }

            if (type == "VP8X" && position + ChunkHeaderLength < content.Length && (content[position + ChunkHeaderLength] & WebPAnimationFlag) != 0)
            {
                return true;
            }

            var next = (long)position + ChunkHeaderLength + length + (length % 2);
            if (next > content.Length)
            {
                return false;
            }

            position = (int)next;
        }

        return false;
    }
}
