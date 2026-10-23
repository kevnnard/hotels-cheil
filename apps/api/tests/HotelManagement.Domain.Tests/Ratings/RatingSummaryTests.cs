using HotelManagement.Domain.Ratings;

namespace HotelManagement.Domain.Tests.Ratings;

public class RatingSummaryTests
{
    [Fact]
    public void Empty_HasNullAverageAndZeroCount()
    {
        var summary = RatingSummary.Empty;

        Assert.Null(summary.Average);
        Assert.Equal(0, summary.Count);
    }

    [Fact]
    public void From_AggregateSumAndCount_ComputesExactAverage()
    {
        var summary = RatingSummary.From(10m, 3);

        Assert.Equal(10m / 3m, summary.Average);
        Assert.Equal(10m, summary.Sum);
        Assert.Equal(3, summary.Count);
    }

    [Theory]
    [InlineData(0, 0)]
    [InlineData(5, 1)]
    [InlineData(1, 1)]
    public void From_AcceptsConsistentAggregates(double sum, int count)
    {
        var summary = RatingSummary.From((decimal)sum, count);

        Assert.Equal(count, summary.Count);
    }

    [Fact]
    public void From_AcceptsSumWithinBoundsForCount()
    {
        var summary = RatingSummary.From(9m, 2);

        Assert.Equal(4.5m, summary.Average);
    }

    [Theory]
    [InlineData(0, -1)]
    [InlineData(3, 0)]
    [InlineData(0.5, 1)]
    [InlineData(5.5, 1)]
    [InlineData(11, 2)]
    public void From_RejectsInconsistentAggregates(double sum, int count)
    {
        Assert.Throws<DomainValidationException>(() => RatingSummary.From((decimal)sum, count));
    }
}
