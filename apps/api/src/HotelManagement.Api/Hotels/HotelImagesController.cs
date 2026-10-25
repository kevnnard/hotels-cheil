using HotelManagement.Application.Images;
using HotelManagement.Domain.Hotels;
using HotelManagement.Domain.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.Net.Http.Headers;

namespace HotelManagement.Api.Hotels;

[ApiController]
[Route("api/hotels/{id:guid}")]
public sealed class HotelImagesController(IHotelImageService images) : ControllerBase
{
    private const long MaximumRequestBytes = ImageLimits.MaximumInputBytes + 1024 * 1024;
    private const string ImageField = "image";
    private const string PrimaryImageRoute = "image";
    private const string PositionedImageRoute = "images/{position:int}";

    [HttpPut(PrimaryImageRoute)]
    [HttpPut(PositionedImageRoute)]
    [Authorize(Policy = HotelPermissions.Update)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(MaximumRequestBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaximumRequestBytes)]
    [ProducesResponseType(typeof(HotelImageResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ValidationProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status413PayloadTooLarge)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status415UnsupportedMediaType)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> Put(
        Guid id,
        IFormFile? image,
        [FromRoute] int position = HotelImageSlot.Primary,
        CancellationToken cancellationToken = default)
    {
        if (image is null)
        {
            return InvalidImage("The multipart field 'image' is required.");
        }

        var outcome = await images.ReplaceAsync(id, position, await ReadBoundedAsync(image, cancellationToken), cancellationToken);
        return outcome.Status switch
        {
            ReplaceHotelImageStatus.Replaced => Ok(HotelImageResponse.From(outcome.Image!)),
            ReplaceHotelImageStatus.HotelNotFound => HotelNotFound(),
            ReplaceHotelImageStatus.PositionNotFound => PositionNotFound(),
            _ => Rejected(outcome.Rejection, outcome.Message)
        };
    }

    [HttpGet(PrimaryImageRoute)]
    [HttpGet(PositionedImageRoute)]
    [Authorize(Policy = HotelPermissions.Read)]
    [ProducesResponseType(typeof(FileStreamResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(
        Guid id,
        [FromRoute] int position = HotelImageSlot.Primary,
        CancellationToken cancellationToken = default)
    {
        var outcome = await images.OpenAsync(id, position, cancellationToken);
        switch (outcome.Status)
        {
            case OpenHotelImageStatus.Opened:
                Response.Headers[HeaderNames.XContentTypeOptions] = "nosniff";
                Response.Headers[HeaderNames.CacheControl] = "private, no-cache";
                return File(outcome.Content!, outcome.Image!.ContentType, null, new EntityTagHeaderValue($"\"{outcome.Image.StorageKey}\""));
            case OpenHotelImageStatus.HotelNotFound:
                return HotelNotFound();
            case OpenHotelImageStatus.PositionNotFound:
                return PositionNotFound();
            default:
                return ImageNotFound();
        }
    }

    [HttpDelete(PrimaryImageRoute)]
    [HttpDelete(PositionedImageRoute)]
    [Authorize(Policy = HotelPermissions.Update)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid id,
        [FromRoute] int position = HotelImageSlot.Primary,
        CancellationToken cancellationToken = default) =>
        await images.RemoveAsync(id, position, cancellationToken) switch
        {
            RemoveHotelImageStatus.Removed => NoContent(),
            RemoveHotelImageStatus.HotelNotFound => HotelNotFound(),
            RemoveHotelImageStatus.PositionNotFound => PositionNotFound(),
            _ => ImageNotFound()
        };

    private static async Task<ReadOnlyMemory<byte>> ReadBoundedAsync(IFormFile image, CancellationToken cancellationToken)
    {
        var buffer = new byte[Math.Min(image.Length, ImageLimits.MaximumInputBytes + 1L)];
        await using var stream = image.OpenReadStream();
        var read = await stream.ReadAtLeastAsync(buffer, buffer.Length, throwOnEndOfStream: false, cancellationToken);
        return buffer.AsMemory(0, read);
    }

    private IActionResult Rejected(ImageRejection? rejection, string? message) =>
        rejection switch
        {
            ImageRejection.Empty or ImageRejection.Corrupt => InvalidImage(message),
            ImageRejection.TooLarge => ProblemResult(StatusCodes.Status413PayloadTooLarge, message),
            ImageRejection.UnsupportedFormat or ImageRejection.Animated => ProblemResult(StatusCodes.Status415UnsupportedMediaType, message),
            _ => ProblemResult(StatusCodes.Status422UnprocessableEntity, message)
        };

    private ObjectResult ProblemResult(int status, string? message) =>
        Problem(title: message ?? "The image cannot be accepted.", statusCode: status);

    private IActionResult InvalidImage(string? message)
    {
        var modelState = new ModelStateDictionary();
        modelState.AddModelError(ImageField, message ?? "The image is not valid.");
        return ValidationProblem(modelState);
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

    private IActionResult PositionNotFound() =>
        NotFound(new ProblemDetails
        {
            Title = "The image position does not exist.",
            Status = StatusCodes.Status404NotFound
        });
}
