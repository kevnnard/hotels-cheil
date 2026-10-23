namespace HotelManagement.Application.Hotels;

public sealed record HotelPage(IReadOnlyList<HotelSummary> Items, int Page, int PageSize, int TotalItems)
{
    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(TotalItems / (double)PageSize);
}
