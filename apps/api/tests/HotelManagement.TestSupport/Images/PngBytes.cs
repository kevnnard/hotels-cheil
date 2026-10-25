using System.Buffers.Binary;
using System.IO.Compression;

namespace HotelManagement.TestSupport.Images;

public static class PngBytes
{
    private static readonly byte[] Signature = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    private static readonly uint[] CrcTable = BuildCrcTable();

    public static byte[] WithTotalSize(byte[] png, int totalSize)
    {
        const int chunkOverhead = 12;
        const string keyword = "padding";
        var dataLength = totalSize - png.Length - chunkOverhead;
        if (dataLength < keyword.Length + 1)
        {
            throw new ArgumentOutOfRangeException(nameof(totalSize));
        }

        var data = new byte[dataLength];
        System.Text.Encoding.ASCII.GetBytes(keyword).CopyTo(data, 0);
        Array.Fill(data, (byte)'x', keyword.Length + 1, dataLength - keyword.Length - 1);
        return InsertBeforeEnd(png, Chunk("tEXt", data));
    }

    public static byte[] Animated(byte[] png)
    {
        var control = new byte[8];
        BinaryPrimitives.WriteUInt32BigEndian(control.AsSpan(0, 4), 2);
        return InsertBeforeEnd(png, Chunk("acTL", control), afterHeader: true);
    }

    public static byte[] WithGamma(byte[] png, uint gammaTimes100000)
    {
        var gamma = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(gamma, gammaTimes100000);
        return InsertBeforeEnd(png, Chunk("gAMA", gamma), afterHeader: true);
    }

    public static byte[] WithChromaticities(byte[] png)
    {
        var chromaticities = new byte[32];
        uint[] values = [31270, 32900, 64000, 33000, 30000, 60000, 15000, 6000];
        for (var index = 0; index < values.Length; index++)
        {
            BinaryPrimitives.WriteUInt32BigEndian(chromaticities.AsSpan(index * 4, 4), values[index]);
        }

        return InsertBeforeEnd(png, Chunk("cHRM", chromaticities), afterHeader: true);
    }

    public static byte[]? ChunkData(byte[] png, string type)
    {
        var position = Signature.Length;
        while (position + 12 <= png.Length)
        {
            var length = (int)BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(position, 4));
            if (System.Text.Encoding.ASCII.GetString(png, position + 4, 4) == type)
            {
                return png.AsSpan(position + 8, length).ToArray();
            }

            position += 12 + length;
        }

        return null;
    }

    public static byte[] WithoutChunk(byte[] png, string type)
    {
        using var output = new MemoryStream();
        output.Write(png, 0, Signature.Length);
        var position = Signature.Length;
        while (position + 12 <= png.Length)
        {
            var length = (int)BinaryPrimitives.ReadUInt32BigEndian(png.AsSpan(position, 4));
            if (System.Text.Encoding.ASCII.GetString(png, position + 4, 4) != type)
            {
                output.Write(png, position, 12 + length);
            }

            position += 12 + length;
        }

        return output.ToArray();
    }

    public static byte[] OpaqueGrayRamp(int width, int height, params (string Type, byte[] Data)[] chunksAfterHeader)
    {
        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(0, 4), (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4, 4), (uint)height);
        header[8] = 8;
        header[9] = 6;

        var scanlines = new byte[height * (1 + width * 4)];
        for (var y = 0; y < height; y++)
        {
            var row = y * (1 + width * 4);
            for (var x = 0; x < width; x++)
            {
                var value = (byte)(x * 255 / width);
                scanlines.AsSpan(row + 1 + x * 4, 4).Fill(value);
                scanlines[row + 1 + x * 4 + 3] = 255;
            }
        }

        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.NoCompression, leaveOpen: true))
        {
            zlib.Write(scanlines);
        }

        using var output = new MemoryStream();
        output.Write(Signature);
        output.Write(Chunk("IHDR", header));
        foreach (var (type, data) in chunksAfterHeader)
        {
            output.Write(Chunk(type, data));
        }

        output.Write(Chunk("IDAT", compressed.ToArray()));
        output.Write(Chunk("IEND", []));
        return output.ToArray();
    }

    public static byte[] WithChunk(byte[] png, string type, byte[] data) =>
        InsertBeforeEnd(png, Chunk(type, data), afterHeader: true);

    public static byte[] WithCorruptedCrc(byte[] png, string type)
    {
        var patched = (byte[])png.Clone();
        var position = Signature.Length;
        while (position + 12 <= patched.Length)
        {
            var length = (int)BinaryPrimitives.ReadUInt32BigEndian(patched.AsSpan(position, 4));
            if (System.Text.Encoding.ASCII.GetString(patched, position + 4, 4) == type)
            {
                patched[position + 8 + length + 3] ^= 0xFF;
                return patched;
            }

            position += 12 + length;
        }

        throw new InvalidOperationException($"The PNG has no {type} chunk.");
    }

    public static byte[] Declaring(int width, int height)
    {
        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(0, 4), (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4, 4), (uint)height);
        header[8] = 8;
        header[9] = 6;

        using var compressed = new MemoryStream();
        using (var zlib = new ZLibStream(compressed, CompressionLevel.SmallestSize, leaveOpen: true))
        {
            zlib.Write(new byte[16]);
        }

        using var output = new MemoryStream();
        output.Write(Signature);
        output.Write(Chunk("IHDR", header));
        output.Write(Chunk("IDAT", compressed.ToArray()));
        output.Write(Chunk("IEND", []));
        return output.ToArray();
    }

    private static byte[] InsertBeforeEnd(byte[] png, byte[] chunk, bool afterHeader = false)
    {
        var position = afterHeader ? Signature.Length + 12 + 13 : png.Length - 12;
        var result = new byte[png.Length + chunk.Length];
        png.AsSpan(0, position).CopyTo(result);
        chunk.CopyTo(result, position);
        png.AsSpan(position).CopyTo(result.AsSpan(position + chunk.Length));
        return result;
    }

    private static byte[] Chunk(string type, byte[] data)
    {
        var chunk = new byte[12 + data.Length];
        BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(0, 4), (uint)data.Length);
        System.Text.Encoding.ASCII.GetBytes(type).CopyTo(chunk, 4);
        data.CopyTo(chunk, 8);
        BinaryPrimitives.WriteUInt32BigEndian(chunk.AsSpan(8 + data.Length, 4), Crc(chunk.AsSpan(4, 4 + data.Length)));
        return chunk;
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
