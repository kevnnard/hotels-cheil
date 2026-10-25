using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Hotels;

public sealed record HotelSummary(
    Guid Id,
    string Name,
    string? Description,
    HotelAddress Address,
    HotelContact Contact,
    bool IsActive,
    DateTime CreatedAtUtc,
    DateTime UpdatedAtUtc,
    RatingSummary Rating,
    IReadOnlyList<HotelImageSlot> Images,
    HotelPricing? Pricing = null)
{
    public HotelImage? Image => Images.FirstOrDefault(slot => slot.Position == HotelImageSlot.Primary)?.Image;
}
