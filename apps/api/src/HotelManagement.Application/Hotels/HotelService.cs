using HotelManagement.Application.Persistence;
using HotelManagement.Domain;
using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Ratings;

namespace HotelManagement.Application.Hotels;

public sealed class HotelService(IHotelStore hotels, IHotelRatingsStore ratings, TimeProvider clock) : IHotelService
{
    public async Task<CreateHotelOutcome> CreateAsync(CreateHotel command, CancellationToken cancellationToken)
    {
        if (!TryBuildDetails(command.Details, out var details, out var invalidField, out var message))
        {
            return CreateHotelOutcome.InvalidInput(invalidField, message);
        }

        var hotel = Hotel.Create(details, clock.GetUtcNow().UtcDateTime);
        await hotels.AddAsync(hotel, cancellationToken);
        return CreateHotelOutcome.Created(hotel.Id);
    }

    public async Task<ListHotelsOutcome> ListAsync(HotelQuery query, CancellationToken cancellationToken)
    {
        if (!query.IsValid)
        {
            return ListHotelsOutcome.InvalidQuery("The hotel query is not valid.");
        }

        var page = await hotels.ListAsync(query, cancellationToken);
        return ListHotelsOutcome.Listed(page);
    }

    public async Task<HotelSummary?> FindAsync(Guid hotelId, CancellationToken cancellationToken)
    {
        var hotel = await hotels.FindAsync(hotelId, cancellationToken);
        return hotel is null ? null : await SummarizeAsync(hotel, cancellationToken);
    }

    public async Task<UpdateHotelOutcome> UpdateAsync(Guid hotelId, UpdateHotel command, CancellationToken cancellationToken)
    {
        var hotel = await hotels.FindAsync(hotelId, cancellationToken);
        if (hotel is null)
        {
            return UpdateHotelOutcome.NotFound();
        }

        if (!TryBuildDetails(command.Details, out var details, out var invalidField, out var message))
        {
            return UpdateHotelOutcome.InvalidInput(invalidField, message);
        }

        hotel.Update(details, clock.GetUtcNow().UtcDateTime);
        if (!await hotels.UpdateAsync(hotel, cancellationToken))
        {
            return UpdateHotelOutcome.NotFound();
        }

        return UpdateHotelOutcome.Updated(await SummarizeAsync(hotel, cancellationToken));
    }

    public Task<bool> DeleteAsync(Guid hotelId, CancellationToken cancellationToken) =>
        hotels.DeleteAsync(hotelId, cancellationToken);

    public async Task<RateHotelOutcome> RateAsync(Guid hotelId, Guid userId, decimal score, CancellationToken cancellationToken)
    {
        RatingScore rating;
        try
        {
            rating = RatingScore.Create(score);
        }
        catch (DomainValidationException exception)
        {
            return RateHotelOutcome.InvalidInput("score", exception.Message);
        }

        if (await hotels.FindAsync(hotelId, cancellationToken) is null)
        {
            return RateHotelOutcome.HotelNotFound();
        }

        var summary = await ratings.RateAsync(hotelId, userId, rating.Value, cancellationToken);
        return summary is null ? RateHotelOutcome.HotelNotFound() : RateHotelOutcome.Rated(summary);
    }

    private async Task<HotelSummary> SummarizeAsync(Hotel hotel, CancellationToken cancellationToken)
    {
        var rating = await ratings.GetSummaryAsync(hotel.Id, cancellationToken) ?? RatingSummary.Empty;
        return new HotelSummary(
            hotel.Id,
            hotel.Details.Name,
            hotel.Details.Description,
            hotel.Details.Address,
            hotel.Details.Contact,
            hotel.IsActive,
            hotel.CreatedAtUtc,
            hotel.UpdatedAtUtc,
            rating);
    }

    private static bool TryBuildDetails(
        HotelDetailsInput input,
        out HotelDetails details,
        out string? invalidField,
        out string message)
    {
        details = null!;
        invalidField = null;
        message = string.Empty;

        try
        {
            _ = new HotelDetails(input.Name);
        }
        catch (DomainValidationException exception)
        {
            invalidField = "name";
            message = exception.Message;
            return false;
        }

        try
        {
            details = new HotelDetails(
                input.Name,
                input.Description,
                new HotelAddress(input.Street, input.City, input.Region, input.Country, input.PostalCode),
                new HotelContact(input.Phone, input.Email, input.Website));
            return true;
        }
        catch (DomainValidationException exception)
        {
            message = exception.Message;
            return false;
        }
    }
}
