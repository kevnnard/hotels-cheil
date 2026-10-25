using HotelManagement.Domain.Hotels;

namespace HotelManagement.Application.Images;

public sealed record ImageSlotChange(bool HotelFound, HotelImage? Previous);

public sealed record HotelDeletion(bool Deleted, HotelImage? ReleasedImage);
