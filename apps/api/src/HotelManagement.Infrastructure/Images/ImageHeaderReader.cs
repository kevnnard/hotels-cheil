using System.Buffers.Binary;

namespace HotelManagement.Infrastructure.Images;

internal static class ImageHeaderReader
{
    private const int PngHeaderEnd = 24;
    private const int WebPHeaderEnd = 30;

    public static bool TryReadDimensions(ImageKind kind, ReadOnlySpan<byte> content, out long width, out long height)
    {
        (width, height) = kind switch
        {
            ImageKind.Png => ReadPng(content),
            ImageKind.Jpeg => ReadJpeg(content),
            _ => ReadWebP(content)
        };

        return width > 0 && height > 0;
    }

    private static (long Width, long Height) ReadPng(ReadOnlySpan<byte> content)
    {
        if (content.Length < PngHeaderEnd || !content.Slice(12, 4).SequenceEqual("IHDR"u8))
        {
            return (0, 0);
        }

        return (BinaryPrimitives.ReadUInt32BigEndian(content.Slice(16, 4)), BinaryPrimitives.ReadUInt32BigEndian(content.Slice(20, 4)));
    }

    private static (long Width, long Height) ReadJpeg(ReadOnlySpan<byte> content)
    {
        var position = 2;
        while (position + 4 <= content.Length)
        {
            if (content[position] != 0xFF)
            {
                position++;
                continue;
            }

            var marker = content[position + 1];
            if (marker == 0xFF)
            {
                position++;
                continue;
            }

            if (marker == 0x01 || marker is >= 0xD0 and <= 0xD8)
            {
                position += 2;
                continue;
            }

            if (marker is 0xD9 or 0xDA)
            {
                return (0, 0);
            }

            if (marker is >= 0xC0 and <= 0xCF and not (0xC4 or 0xC8 or 0xCC))
            {
                return position + 9 <= content.Length
                    ? (BinaryPrimitives.ReadUInt16BigEndian(content.Slice(position + 7, 2)), BinaryPrimitives.ReadUInt16BigEndian(content.Slice(position + 5, 2)))
                    : (0, 0);
            }

            position += 2 + BinaryPrimitives.ReadUInt16BigEndian(content.Slice(position + 2, 2));
        }

        return (0, 0);
    }

    private static (long Width, long Height) ReadWebP(ReadOnlySpan<byte> content)
    {
        if (content.Length < WebPHeaderEnd)
        {
            return (0, 0);
        }

        var chunk = content.Slice(12, 4);
        if (chunk.SequenceEqual("VP8X"u8))
        {
            return (1 + (content[24] | content[25] << 8 | content[26] << 16), 1 + (content[27] | content[28] << 8 | content[29] << 16));
        }

        if (chunk.SequenceEqual("VP8 "u8) && content[23] == 0x9D && content[24] == 0x01 && content[25] == 0x2A)
        {
            return ((content[26] | content[27] << 8) & 0x3FFF, (content[28] | content[29] << 8) & 0x3FFF);
        }

        if (chunk.SequenceEqual("VP8L"u8) && content[20] == 0x2F)
        {
            var bits = BinaryPrimitives.ReadUInt32LittleEndian(content.Slice(21, 4));
            return (1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF));
        }

        return (0, 0);
    }
}
