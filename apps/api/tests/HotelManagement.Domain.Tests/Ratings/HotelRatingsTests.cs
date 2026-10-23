using HotelManagement.Domain.Ratings;

namespace HotelManagement.Domain.Tests.Ratings;

public class HotelRatingsTests
{
    private static readonly Guid FirstUser = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid SecondUser = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly Guid ThirdUser = Guid.Parse("00000000-0000-0000-0000-000000000003");

    [Fact]
    public void Summary_WithoutScores_HasNullAverageAndZeroCount()
    {
        var ratings = new HotelRatings();

        Assert.Null(ratings.Summary.Average);
        Assert.Equal(0, ratings.Summary.Count);
        Assert.Equal(0m, ratings.Summary.Sum);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(5)]
    [InlineData(3.5)]
    public void Rate_AcceptsScoresWithinInclusiveRange(double score)
    {
        var ratings = new HotelRatings();

        ratings.Rate(FirstUser, (decimal)score);

        Assert.Equal(1, ratings.Summary.Count);
        Assert.Equal((decimal)score, ratings.Summary.Average);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(0.99)]
    [InlineData(5.01)]
    [InlineData(6)]
    public void Rate_RejectsScoresOutsideRange(double score)
    {
        var ratings = new HotelRatings();

        Assert.Throws<DomainValidationException>(() => ratings.Rate(FirstUser, (decimal)score));
    }

    [Fact]
    public void Rate_RejectsEmptyUserIdentifier()
    {
        var ratings = new HotelRatings();

        Assert.Throws<DomainValidationException>(() => ratings.Rate(Guid.Empty, 4m));
        Assert.Equal(RatingSummary.Empty, ratings.Summary);
    }

    [Fact]
    public void Summary_WithMultipleUsers_AveragesAllScores()
    {
        var ratings = new HotelRatings();

        ratings.Rate(FirstUser, 5m);
        ratings.Rate(SecondUser, 4m);

        Assert.Equal(2, ratings.Summary.Count);
        Assert.Equal(4.5m, ratings.Summary.Average);
    }

    [Fact]
    public void Summary_AverageIsNotRounded()
    {
        var ratings = new HotelRatings();

        ratings.Rate(FirstUser, 1m);
        ratings.Rate(SecondUser, 1m);
        ratings.Rate(ThirdUser, 2m);

        Assert.Equal(4m / 3m, ratings.Summary.Average);
    }

    [Fact]
    public void Rate_SameUserAgain_ReplacesScoreWithoutIncreasingCount()
    {
        var ratings = new HotelRatings();
        ratings.Rate(FirstUser, 5m);
        ratings.Rate(SecondUser, 3m);

        ratings.Rate(FirstUser, 1m);

        Assert.Equal(2, ratings.Summary.Count);
        Assert.Equal(4m, ratings.Summary.Sum);
        Assert.Equal(2m, ratings.Summary.Average);
    }

    [Fact]
    public void Rate_IdenticalRepeat_LeavesSummaryUnchanged()
    {
        var ratings = new HotelRatings();
        ratings.Rate(FirstUser, 4m);
        var before = ratings.Summary;

        ratings.Rate(FirstUser, 4m);

        Assert.Equal(before, ratings.Summary);
        Assert.Equal(1, ratings.Summary.Count);
    }

    [Fact]
    public void Rate_InvalidAttemptByExistingUser_KeepsPreviousScore()
    {
        var ratings = new HotelRatings();
        ratings.Rate(FirstUser, 4m);
        var before = ratings.Summary;

        Assert.Throws<DomainValidationException>(() => ratings.Rate(FirstUser, 6m));

        Assert.Equal(before, ratings.Summary);
        Assert.Equal(1, ratings.Summary.Count);
        Assert.Equal(4m, ratings.Summary.Average);
    }

    [Fact]
    public void Rate_InvalidAttemptByNewUser_DoesNotAddVote()
    {
        var ratings = new HotelRatings();
        ratings.Rate(FirstUser, 4m);
        var before = ratings.Summary;

        Assert.Throws<DomainValidationException>(() => ratings.Rate(SecondUser, 0m));

        Assert.Equal(before, ratings.Summary);
        Assert.Equal(1, ratings.Summary.Count);
        Assert.Equal(4m, ratings.Summary.Sum);
    }
}
