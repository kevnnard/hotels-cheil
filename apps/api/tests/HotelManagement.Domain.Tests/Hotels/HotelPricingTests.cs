using System.Globalization;
using HotelManagement.Domain.Hotels;

namespace HotelManagement.Domain.Tests.Hotels;

public class HotelPricingTests
{
    [Fact]
    public void From_WithoutPriceAndWithoutDiscount_IsNoPricing()
    {
        Assert.Null(HotelPricing.From(null, null));
    }

    [Fact]
    public void From_WithADiscountButNoPrice_IsRejected()
    {
        var exception = Assert.Throws<DomainValidationException>(() => HotelPricing.From(null, 10));

        Assert.Equal("A discount requires a nightly price.", exception.Message);
    }

    [Fact]
    public void Pricing_WithoutADiscount_UsesTheNightlyRateAsTheEffectiveRate()
    {
        var pricing = HotelPricing.From(150m, null)!;

        Assert.Equal("USD", HotelPricing.Currency);
        Assert.Equal(150m, pricing.NightlyRate);
        Assert.Null(pricing.DiscountPercent);
        Assert.Null(pricing.DiscountedNightlyRate);
        Assert.Equal(150m, pricing.EffectiveNightlyRate);
    }

    [Theory]
    [InlineData(199.99, 15, 169.99)]
    [InlineData(10.10, 15, 8.59)]
    [InlineData(0.05, 90, 0.01)]
    [InlineData(100000, 90, 10000)]
    [InlineData(100000, 1, 99000)]
    [InlineData(0.01, 50, 0.01)]
    [InlineData(0.01, 51, 0)]
    public void Pricing_WithADiscount_RoundsTheDiscountedRateToCentsAwayFromZero(double price, int discount, double expected)
    {
        var pricing = HotelPricing.From((decimal)price, discount)!;

        Assert.Equal(discount, pricing.DiscountPercent);
        Assert.Equal((decimal)expected, pricing.DiscountedNightlyRate);
        Assert.Equal((decimal)expected, pricing.EffectiveNightlyRate);
    }

    [Theory]
    [InlineData(0.01)]
    [InlineData(100000)]
    [InlineData(99999.99)]
    [InlineData(120.5)]
    public void Pricing_AcceptsPricesWithinTheLimits(double price)
    {
        Assert.Equal((decimal)price, HotelPricing.From((decimal)price, null)!.NightlyRate);
    }

    [Fact]
    public void Pricing_AcceptsTrailingZerosBeyondTwoDecimals()
    {
        Assert.Equal(10.5m, HotelPricing.From(10.500m, null)!.NightlyRate);
    }

    [Theory]
    [InlineData("0")]
    [InlineData("-1")]
    [InlineData("-0.01")]
    public void Pricing_RejectsAPriceThatIsNotPositive(string price)
    {
        var exception = Assert.Throws<DomainValidationException>(() => HotelPricing.From(decimal.Parse(price, CultureInfo.InvariantCulture), null));

        Assert.Equal("Price per night must be greater than 0.", exception.Message);
    }

    [Fact]
    public void Pricing_RejectsAPriceAboveTheMaximum()
    {
        var exception = Assert.Throws<DomainValidationException>(() => HotelPricing.From(100000.01m, null));

        Assert.Equal("Price per night cannot exceed 100000.", exception.Message);
    }

    [Theory]
    [InlineData("10.001")]
    [InlineData("199.999")]
    public void Pricing_RejectsMoreThanTwoDecimals(string price)
    {
        var exception = Assert.Throws<DomainValidationException>(() => HotelPricing.From(decimal.Parse(price, CultureInfo.InvariantCulture), null));

        Assert.Equal("Price per night cannot have more than two decimals.", exception.Message);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(90)]
    public void Pricing_AcceptsDiscountsAtTheLimits(int discount)
    {
        Assert.Equal(discount, HotelPricing.From(100m, discount)!.DiscountPercent);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(91)]
    [InlineData(-5)]
    [InlineData(100)]
    public void Pricing_RejectsDiscountsOutsideTheRange(int discount)
    {
        var exception = Assert.Throws<DomainValidationException>(() => HotelPricing.From(100m, discount));

        Assert.Equal("Discount percent must be between 1 and 90.", exception.Message);
    }

    [Fact]
    public void Details_KeepTheirPricingAndCompareByValue()
    {
        var details = new HotelDetails("Gran Hotel", pricing: HotelPricing.From(200m, 20));

        Assert.Equal(160m, details.Pricing!.DiscountedNightlyRate);
        Assert.Equal(new HotelDetails("Gran Hotel", pricing: HotelPricing.From(200.00m, 20)), details);
        Assert.NotEqual(new HotelDetails("Gran Hotel", pricing: HotelPricing.From(200m, null)), details);
        Assert.Null(new HotelDetails("Gran Hotel").Pricing);
    }
}
