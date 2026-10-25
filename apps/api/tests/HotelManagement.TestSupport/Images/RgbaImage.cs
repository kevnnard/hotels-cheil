namespace HotelManagement.TestSupport.Images;

public sealed record RgbaImage(int Width, int Height, ushort[] Samples)
{
    public static RgbaImage Noise(int width, int height, int seed, bool sixteenBit = false, bool transparentRgb = false)
    {
        var random = new Random(seed);
        var samples = new ushort[width * height * 4];
        for (var index = 0; index < samples.Length; index += 4)
        {
            samples[index] = Sample(random, sixteenBit);
            samples[index + 1] = Sample(random, sixteenBit);
            samples[index + 2] = Sample(random, sixteenBit);
            samples[index + 3] = transparentRgb && index % 32 == 0 ? (ushort)0 : Sample(random, sixteenBit);
        }

        return new RgbaImage(width, height, samples);
    }

    public static RgbaImage Gradient(int width, int height, bool sixteenBit = false, bool transparentRgb = false)
    {
        var samples = new ushort[width * height * 4];
        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var index = (y * width + x) * 4;
                samples[index] = Scale(x, width, sixteenBit);
                samples[index + 1] = Scale(y, height, sixteenBit);
                samples[index + 2] = Scale(x + y, width + height, sixteenBit);
                var hidden = transparentRgb && (x / 8 + y / 8) % 2 == 0;
                samples[index + 3] = hidden ? (ushort)0 : ushort.MaxValue;
            }
        }

        return new RgbaImage(width, height, samples);
    }

    private static ushort Sample(Random random, bool sixteenBit) =>
        sixteenBit ? (ushort)random.Next(ushort.MaxValue + 1) : (ushort)(random.Next(256) * 257);

    private static ushort Scale(int value, int span, bool sixteenBit)
    {
        var fraction = value / (double)Math.Max(1, span - 1);
        return sixteenBit ? (ushort)(fraction * ushort.MaxValue) : (ushort)((int)(fraction * 255) * 257);
    }
}
