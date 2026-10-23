namespace HotelManagement.Domain.Ratings;

public sealed record RatingScore
{
    public const decimal Minimum = 1m;
    public const decimal Maximum = 5m;

    public decimal Value { get; }

    private RatingScore(decimal value) => Value = value;

    public static RatingScore Create(decimal value)
    {
        if (value < Minimum || value > Maximum)
        {
            throw new DomainValidationException($"A rating must be between {Minimum} and {Maximum}.");
        }

        return new RatingScore(value);
    }
}
