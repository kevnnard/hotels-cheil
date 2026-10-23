namespace HotelManagement.Domain.Ratings;

public sealed record RatingSummary
{
    public decimal Sum { get; }
    public int Count { get; }
    public decimal? Average => Count == 0 ? null : Sum / Count;

    private RatingSummary(decimal sum, int count)
    {
        Sum = sum;
        Count = count;
    }

    public static RatingSummary Empty { get; } = new(0m, 0);

    public static RatingSummary From(decimal sum, int count)
    {
        if (count < 0)
        {
            throw new DomainValidationException("The rating count cannot be negative.");
        }

        if (sum < count * RatingScore.Minimum || sum > count * RatingScore.Maximum)
        {
            throw new DomainValidationException("The rating sum is inconsistent with the rating count.");
        }

        return new RatingSummary(sum, count);
    }
}
