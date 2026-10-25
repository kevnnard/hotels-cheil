using HotelManagement.Application.Hotels;
using HotelManagement.Application.Images;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Net.Http.Headers;

namespace HotelManagement.Api.Hotels;

[ApiController]
[AllowAnonymous]
[Route("api/public/hotels")]
public sealed class PublicHotelsController(IHotelService hotels, IHotelImageService images) : ControllerBase
{
    private const string GeneralErrorKey = "request";

    [HttpGet]
    [ProducesResponseType(typeof(HotelPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> List(
        [FromQuery] string? name,
        [FromQuery] decimal? minRating,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = HotelQuery.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var query = new HotelQuery { Name = name, MinimumRating = minRating, Page = page, PageSize = pageSize, ActiveOnly = true };
        var outcome = await hotels.ListAsync(query, cancellationToken);

        return outcome.Status == ListHotelsStatus.Listed
            ? Ok(HotelPageResponse.From(outcome.Page!))
            : InvalidInput(outcome.Message);
    }

    [HttpGet("{id:guid}", Name = nameof(GetPublic))]
    [ProducesResponseType(typeof(HotelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPublic(Guid id, CancellationToken cancellationToken)
    {
        var hotel = await hotels.FindActiveAsync(id, cancellationToken);
        return hotel is null ? HotelNotFound() : Ok(HotelResponse.From(hotel));
    }

    [HttpGet("{id:guid}/image")]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetImage(Guid id, CancellationToken cancellationToken)
    {
        var outcome = await images.OpenActiveAsync(id, cancellationToken);
        switch (outcome.Status)
        {
            case OpenHotelImageStatus.Opened:
                Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
                Response.Headers[HeaderNames.CacheControl] = "private, no-cache";
                return File(outcome.Content!, outcome.Image!.ContentType, null, new EntityTagHeaderValue($"\"{outcome.Image.StorageKey}\""));
            case OpenHotelImageStatus.HotelNotFound:
                return HotelNotFound();
            default:
                return ImageNotFound();
        }
    }

    private IActionResult HotelNotFound() =>
        NotFound(new ProblemDetails
        {
            Title = "The hotel does not exist.",
            Status = StatusCodes.Status404NotFound
        });

    private IActionResult ImageNotFound() =>
        NotFound(new ProblemDetails
        {
            Title = "The hotel has no image.",
            Status = StatusCodes.Status404NotFound
        });

    private IActionResult InvalidInput(string? message)
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(GeneralErrorKey, message ?? "The request is not valid.");
        return ValidationProblem(modelState);
    }
}
