namespace HotelManagement.Domain.Hotels;

public sealed record HotelPricing
{
    public const string Currency = "USD";
    public const decimal MaximumNightlyRate = 100_000m;
    public const int MinimumDiscountPercent = 1;
    public const int MaximumDiscountPercent = 90;

    public decimal NightlyRate { get; }
    public int? DiscountPercent { get; }
    public decimal? DiscountedNightlyRate { get; }
    public decimal EffectiveNightlyRate => DiscountedNightlyRate ?? NightlyRate;

    private HotelPricing(decimal nightlyRate, int? discountPercent)
    {
        NightlyRate = RequireValidNightlyRate(nightlyRate);
        DiscountPercent = discountPercent is { } percent ? RequireValidDiscount(percent) : null;
        DiscountedNightlyRate = DiscountPercent is { } discount ? Discounted(NightlyRate, discount) : null;
    }

    public static HotelPricing? From(decimal? nightlyRate, int? discountPercent)
    {
        if (nightlyRate is { } rate)
        {
            return new HotelPricing(rate, discountPercent);
        }

        return discountPercent is null
            ? null
            : throw new DomainValidationException("A discount requires a nightly price.");
    }

    private static decimal Discounted(decimal nightlyRate, int discountPercent) =>
        Math.Round(nightlyRate * (100 - discountPercent) / 100m, 2, MidpointRounding.AwayFromZero);

    private static decimal RequireValidNightlyRate(decimal value)
    {
        if (value <= 0)
        {
            throw new DomainValidationException("Price per night must be greater than 0.");
        }

        if (value > MaximumNightlyRate)
        {
            throw new DomainValidationException($"Price per night cannot exceed {MaximumNightlyRate}.");
        }

        if (decimal.Round(value, 2) != value)
        {
            throw new DomainValidationException("Price per night cannot have more than two decimals.");
        }

        return value;
    }

    private static int RequireValidDiscount(int value) =>
        value is >= MinimumDiscountPercent and <= MaximumDiscountPercent
            ? value
            : throw new DomainValidationException(
                $"Discount percent must be between {MinimumDiscountPercent} and {MaximumDiscountPercent}.");
}
