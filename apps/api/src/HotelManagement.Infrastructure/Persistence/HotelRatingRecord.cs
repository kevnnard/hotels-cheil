namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelRatingRecord
{
    public Guid HotelId { get; set; }
    public Guid UserId { get; set; }
    public decimal Score { get; set; }
}
