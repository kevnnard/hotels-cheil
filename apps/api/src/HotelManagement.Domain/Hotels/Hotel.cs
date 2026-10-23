namespace HotelManagement.Domain.Hotels;

public sealed class Hotel
{
    public Guid Id { get; }
    public HotelDetails Details { get; private set; }
    public bool IsActive { get; private set; }
    public DateTime CreatedAtUtc { get; }
    public DateTime UpdatedAtUtc { get; private set; }

    private Hotel(Guid id, HotelDetails details, DateTime nowUtc)
    {
        Id = id;
        Details = details;
        IsActive = true;
        CreatedAtUtc = nowUtc;
        UpdatedAtUtc = nowUtc;
    }

    public static Hotel Create(HotelDetails details, DateTime nowUtc)
    {
        RequireUtc(nowUtc);
        return new Hotel(Guid.CreateVersion7(), details, nowUtc);
    }

    public void Update(HotelDetails details, DateTime nowUtc)
    {
        RequireUtc(nowUtc);
        Details = details;
        UpdatedAtUtc = nowUtc;
    }

    public void SetActive(bool isActive, DateTime nowUtc)
    {
        RequireUtc(nowUtc);
        if (IsActive == isActive)
        {
            return;
        }

        IsActive = isActive;
        UpdatedAtUtc = nowUtc;
    }

    private static void RequireUtc(DateTime value)
    {
        if (value.Kind != DateTimeKind.Utc)
        {
            throw new DomainValidationException("Timestamps must be expressed in UTC.");
        }
    }
}
