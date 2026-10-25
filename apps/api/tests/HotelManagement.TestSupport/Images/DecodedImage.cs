namespace HotelManagement.TestSupport.Images;

public sealed record DecodedImage(int Width, int Height, ushort[] Samples, byte[]? IccProfile, int Orientation, string Format, double Gamma);
