namespace HotelManagement.Domain.Hotels;

public sealed class Hotel
{
    public Guid Id { get; }
    public HotelDetails Details { get; private set; }
    public bool IsActive { get; private set; }
    public IReadOnlyList<HotelImageSlot> Images => [.. images.Values];
    public HotelImage? Image => images.GetValueOrDefault(HotelImageSlot.Primary)?.Image;
    public DateTime CreatedAtUtc { get; }
    public DateTime UpdatedAtUtc { get; private set; }

    private readonly SortedDictionary<int, HotelImageSlot> images = [];

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
        IEnumerable<HotelImageSlot>? images = null)
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

        var hotel = new Hotel(id, details, createdAtUtc)
        {
            IsActive = isActive,
            UpdatedAtUtc = updatedAtUtc
        };

        foreach (var slot in images ?? [])
        {
            if (hotel.images.ContainsKey(slot.Position))
            {
                throw new DomainValidationException($"A hotel holds at most one image in position {slot.Position}.");
            }

            hotel.RequireUnusedStorageKey(slot.Image, slot.Position);
            hotel.images.Add(slot.Position, slot);
        }

        return hotel;
    }

    public HotelImage? ImageAt(int position) =>
        images.GetValueOrDefault(HotelImageSlot.RequireValidPosition(position))?.Image;

    public HotelImage? PlaceImage(int position, HotelImage image, DateTime nowUtc)
    {
        var slot = new HotelImageSlot(position, image);
        RequireUtc(nowUtc);
        RequireUnusedStorageKey(image, position);

        var displaced = ImageAt(position);
        images[position] = slot;
        UpdatedAtUtc = nowUtc;
        return displaced;
    }

    public HotelImage? RemoveImage(int position, DateTime nowUtc)
    {
        var removed = ImageAt(position);
        RequireUtc(nowUtc);
        if (removed is null)
        {
            return null;
        }

        images.Remove(position);
        UpdatedAtUtc = nowUtc;
        return removed;
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

    private void RequireUnusedStorageKey(HotelImage image, int position)
    {
        if (images.Values.Any(slot => slot.Position != position && slot.Image.StorageKey == image.StorageKey))
        {
            throw new DomainValidationException("One stored image cannot fill two positions of a hotel.");
        }
    }

    private static void RequireUtc(DateTime value)
    {
        if (value.Kind != DateTimeKind.Utc)
        {
            throw new DomainValidationException("Timestamps must be expressed in UTC.");
        }
    }
}
