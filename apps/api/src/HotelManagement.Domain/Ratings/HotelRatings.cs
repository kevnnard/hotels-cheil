namespace HotelManagement.Domain.Ratings;

public sealed class HotelRatings
{
    private readonly Dictionary<Guid, RatingScore> scoresByUser = [];

    public RatingSummary Summary =>
        RatingSummary.From(scoresByUser.Values.Sum(score => score.Value), scoresByUser.Count);

    public void Rate(Guid userId, decimal value)
    {
        if (userId == Guid.Empty)
        {
            throw new DomainValidationException("A rating requires a user identifier.");
        }

        scoresByUser[userId] = RatingScore.Create(value);
    }
}
