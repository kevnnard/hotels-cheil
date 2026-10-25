using System.Buffers.Binary;
using System.Text;

namespace HotelManagement.Infrastructure.Images;

internal static class PngChunks
{
    private const int SignatureLength = 8;
    private const int ChunkOverhead = 12;
    private const int HeaderDataLength = 13;
    private const long MaximumChunkLength = int.MaxValue;
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly uint[] CrcTable = BuildCrcTable();

    public static bool IsIntact(ReadOnlySpan<byte> content)
    {
        if (!content.StartsWith(Signature))
        {
            return false;
        }

        var position = SignatureLength;
        var first = true;
        while (position + ChunkOverhead <= content.Length)
        {
            var length = BinaryPrimitives.ReadUInt32BigEndian(content.Slice(position, 4));
            var end = (long)position + ChunkOverhead + length;
            if (length > MaximumChunkLength || end > content.Length)
            {
                return false;
            }

            var type = content.Slice(position + 4, 4);
            var storedCrc = BinaryPrimitives.ReadUInt32BigEndian(content.Slice(position + 8 + (int)length, 4));
            if (Crc(content.Slice(position + 4, 4 + (int)length)) != storedCrc)
            {
                return false;
            }

            if (first && (!type.SequenceEqual("IHDR"u8) || length != HeaderDataLength))
            {
                return false;
            }

            first = false;
            if (type.SequenceEqual("IEND"u8))
            {
                return length == 0;
            }

            position = (int)end;
        }

        return false;
    }

    public static byte[]? Data(ReadOnlySpan<byte> content, string wanted)
    {
        var position = SignatureLength;
        while (position + ChunkOverhead <= content.Length)
        {
            var length = BinaryPrimitives.ReadUInt32BigEndian(content.Slice(position, 4));
            var next = (long)position + ChunkOverhead + length;
            if (next > content.Length)
            {
                return null;
            }

            var type = Encoding.ASCII.GetString(content.Slice(position + 4, 4));
            if (type == wanted)
            {
                return content.Slice(position + 8, (int)length).ToArray();
            }

            if (type is "IDAT" or "IEND")
            {
                return null;
            }

            position = (int)next;
        }

        return null;
    }

    public static byte[] InsertAfterHeader(byte[] png, string type, byte[] data)
    {
        var insertAt = SignatureLength + ChunkOverhead + HeaderDataLength;
        var chunk = new byte[ChunkOverhead + data.Length];
        BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(0, 4), (uint)data.Length);
        Encoding.ASCII.GetBytes(type).CopyTo(chunk, 4);
        data.CopyTo(chunk, 8);
        BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(8 + data.Length, 4), Crc(chunk.AsSpan(4, 4 + data.Length)));

        var result = new byte[png.Length + chunk.Length];
        png.AsSpan(0, insertAt).CopyTo(result);
        chunk.CopyTo(result, insertAt);
        png.AsSpan(insertAt).CopyTo(result.AsSpan(insertAt + chunk.Length));
        return result;
    }

    private static uint Crc(ReadOnlySpan<byte> bytes)
    {
        var crc = uint.MaxValue;
        foreach (var value in bytes)
        {
            crc = CrcTable[(crc ^ value) & 0xFF] ^ (crc >> 8);
        }

        return crc ^ uint.MaxValue;
    }

    private static uint[] BuildCrcTable()
    {
        var table = new uint[256];
        for (uint index = 0; index < table.Length; index++)
        {
            var value = index;
            for (var bit = 0; bit < 8; bit++)
            {
                value = (value & 1) != 0 ? 0xEDB88320u ^ (value >> 1) : value >> 1;
            }

            table[index] = value;
        }

        return table;
    }
}
