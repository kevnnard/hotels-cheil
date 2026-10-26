using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace HotelManagement.Api.Hotels;

[ApiController]
[Route("api/hotels")]
public sealed class HotelsController(IHotelService hotels) : ControllerBase
{
    private const string GeneralErrorKey = "request";

    [HttpGet]
    [Authorize(Policy = HotelPermissions.Read)]
    [ProducesResponseType(typeof(HotelPageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> List(
        [FromQuery] string? name,
        [FromQuery] decimal? minRating,
        [FromQuery] decimal? maxPrice,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = HotelQuery.DefaultPageSize,
        CancellationToken cancellationToken = default)
    {
        var query = new HotelQuery { Name = name, MinimumRating = minRating, MaximumPrice = maxPrice, Page = page, PageSize = pageSize };
        var outcome = await hotels.ListAsync(query, cancellationToken);

        return outcome.Status == ListHotelsStatus.Listed
            ? Ok(HotelPageResponse.From(outcome.Page!))
            : InvalidInput(null, outcome.Message);
    }

    [HttpGet("{id:guid}", Name = nameof(Get))]
    [Authorize(Policy = HotelPermissions.Read)]
    [ProducesResponseType(typeof(HotelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var hotel = await hotels.FindAsync(id, cancellationToken);
        return hotel is null ? HotelNotFound() : Ok(HotelResponse.From(hotel));
    }

    [HttpPost]
    [Authorize(Policy = HotelPermissions.Create)]
    [ProducesResponseType(typeof(HotelResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Create([FromBody] HotelRequest request, CancellationToken cancellationToken)
    {
        var outcome = await hotels.CreateAsync(new CreateHotel(request.ToInput()), cancellationToken);
        if (outcome.Status != CreateHotelStatus.Created)
        {
            return InvalidInput(outcome.InvalidField, outcome.Message);
        }

        var created = await hotels.FindAsync(outcome.HotelId, cancellationToken);
        return CreatedAtRoute(nameof(Get), new { id = outcome.HotelId }, HotelResponse.From(created!));
    }

    [HttpPut("{id:guid}")]
    [Authorize(Policy = HotelPermissions.Update)]
    [ProducesResponseType(typeof(HotelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(Guid id, [FromBody] HotelRequest request, CancellationToken cancellationToken)
    {
        var outcome = await hotels.UpdateAsync(id, new UpdateHotel(request.ToInput()), cancellationToken);

        return outcome.Status switch
        {
            UpdateHotelStatus.Updated => Ok(HotelResponse.From(outcome.Hotel!)),
            UpdateHotelStatus.NotFound => HotelNotFound(),
            _ => InvalidInput(outcome.InvalidField, outcome.Message)
        };
    }

    [HttpPut("{id:guid}/status")]
    [Authorize(Policy = HotelPermissions.Update)]
    [ProducesResponseType(typeof(HotelResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetStatus(Guid id, [FromBody] HotelStatusRequest request, CancellationToken cancellationToken)
    {
        if (request.IsActive is not { } isActive)
        {
            return InvalidInput("isActive", "The active state is required and must be true or false.");
        }

        var hotel = await hotels.SetActiveAsync(id, isActive, cancellationToken);
        return hotel is null ? HotelNotFound() : Ok(HotelResponse.From(hotel));
    }

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = HotelPermissions.Delete)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken) =>
        await hotels.DeleteAsync(id, cancellationToken) ? NoContent() : HotelNotFound();

    private IActionResult HotelNotFound() =>
        NotFound(new ProblemDetails
        {
            Title = "The hotel does not exist.",
            Status = StatusCodes.Status404NotFound
        });

    private IActionResult InvalidInput(string? field, string? message)
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(field ?? GeneralErrorKey, message ?? "The request is not valid.");
        return ValidationProblem(modelState);
    }
}
