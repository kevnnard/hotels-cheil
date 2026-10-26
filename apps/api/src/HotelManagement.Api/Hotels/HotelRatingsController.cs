using HotelManagement.Application.Hotels;
using HotelManagement.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace HotelManagement.Api.Hotels;

[ApiController]
[Route("api/hotels/{id:guid}/ratings")]
public sealed class HotelRatingsController(IHotelService hotels) : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = HotelPermissions.Rate)]
    [ProducesResponseType(typeof(RatingSummaryResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Rate(Guid id, [FromBody] RateHotelRequest request, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userId))
        {
            return Unauthorized();
        }

        var outcome = await hotels.RateAsync(id, userId, request.Score, cancellationToken);

        return outcome.Status switch
        {
            RateHotelStatus.Rated => Ok(RatingSummaryResponse.From(outcome.Rating!)),
            RateHotelStatus.HotelNotFound => HotelNotFound(),
            _ => InvalidScore(outcome.Message)
        };
    }

    [HttpGet("me")]
    [Authorize(Policy = HotelPermissions.Rate)]
    [ProducesResponseType(typeof(OwnRatingResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetOwn(Guid id, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("sub")?.Value, out var userId))
        {
            return Unauthorized();
        }

        var outcome = await hotels.FindOwnRatingAsync(id, userId, cancellationToken);

        return outcome.Status == OwnRatingStatus.Found
            ? Ok(new OwnRatingResponse(outcome.Score))
            : HotelNotFound();
    }

    private NotFoundObjectResult HotelNotFound() => NotFound(new ProblemDetails
    {
        Title = "The hotel does not exist.",
        Status = StatusCodes.Status404NotFound
    });

    private IActionResult InvalidScore(string? message)
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError("score", message ?? "The score is not valid.");
        return ValidationProblem(modelState);
    }
}
