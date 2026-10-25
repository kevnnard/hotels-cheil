using System.Buffers.Binary;

namespace HotelManagement.TestSupport.Images;

public static class ContainerBytes
{
    public static byte[] JpegDeclaring(byte[] jpeg, int width, int height)
    {
        var patched = (byte[])jpeg.Clone();
        for (var position = 2; position + 9 < patched.Length; position++)
        {
            if (patched[position] == 0xFF && patched[position + 1] is 0xC0 or 0xC1 or 0xC2)
            {
                BinaryPrimitives.WriteUInt16BigEndian(patched.AsSpan(position + 5, 2), (ushort)height);
                BinaryPrimitives.WriteUInt16BigEndian(patched.AsSpan(position + 7, 2), (ushort)width);
                return patched;
            }
        }

        throw new InvalidOperationException("The JPEG has no frame header.");
    }

    public static byte[] WebPDeclaring(byte[] webp, int width, int height)
    {
        var patched = (byte[])webp.Clone();
        var chunk = System.Text.Encoding.ASCII.GetString(patched, 12, 4);
        if (chunk == "VP8L")
        {
            var bits = (uint)(width - 1) | ((uint)(height - 1) << 14) | (BinaryPrimitives.ReadUInt32LittleEndian(patched.AsSpan(21, 4)) & 0xF0000000u);
            BinaryPrimitives.WriteUInt32LittleEndian(patched.AsSpan(21, 4), bits);
            return patched;
        }

        if (chunk == "VP8X")
        {
            WriteUInt24(patched, 24, width - 1);
            WriteUInt24(patched, 27, height - 1);
            return patched;
        }

        throw new InvalidOperationException($"Unsupported WebP chunk {chunk}.");
    }

    private static void WriteUInt24(byte[] target, int offset, int value)
    {
        target[offset] = (byte)value;
        target[offset + 1] = (byte)(value >> 8);
        target[offset + 2] = (byte)(value >> 16);
    }
}
