namespace HotelManagement.Domain.Hotels;

public sealed class Hotel
{
    public Guid Id { get; }
    public HotelDetails Details { get; private set; }
    public bool IsActive { get; private set; }
    public HotelImage? Image { get; private set; }
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

    public static Hotel Restore(
        Guid id,
        HotelDetails details,
        bool isActive,
        DateTime createdAtUtc,
        DateTime updatedAtUtc,
        HotelImage? image = null)
    {
        if (id == Guid.Empty)
        {
            throw new DomainValidationException("A stored hotel requires an identifier.");
        }

        RequireUtc(createdAtUtc);
        RequireUtc(updatedAtUtc);
        if (updatedAtUtc < createdAtUtc)
        {
            throw new DomainValidationException("A hotel cannot be updated before it was created.");
        }

        return new Hotel(id, details, createdAtUtc)
        {
            IsActive = isActive,
            UpdatedAtUtc = updatedAtUtc,
            Image = image
        };
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
