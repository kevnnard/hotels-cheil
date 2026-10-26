using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Application.Persistence;
using HotelManagement.TestSupport.Images;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class HotelImageGalleryEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private HotelApiFactory factory = null!;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient user = null!;

    private string Marker { get; } = Guid.CreateVersion7().ToString("N");

    public async Task InitializeAsync()
    {
        factory = new HotelApiFactory(api.ConnectionString, AdministratorEmail, AdministratorPassword);
        anonymous = factory.CreateClient();
        administrator = factory.CreateClient();
        user = factory.CreateClient();

        var administratorToken = await SignInAsync(AdministratorEmail, AdministratorPassword);
        administrator.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", administratorToken.AccessToken);

        var email = $"{Guid.CreateVersion7()}@example.com";
        await anonymous.PostAsJsonAsync("/api/auth/register", new { email, password = UserPassword });
        var userToken = await SignInAsync(email, UserPassword);
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userToken.AccessToken);
    }

    public async Task DisposeAsync()
    {
        anonymous.Dispose();
        administrator.Dispose();
        user.Dispose();
        await factory.DisposeAsync();
    }

    private static byte[] SmallPng(int seed) => TestImages.Png(RgbaImage.Noise(40, 30, seed, sixteenBit: true), depth: 16);

    [Fact]
    public async Task EveryPosition_StoresItsOwnImageAndTheHotelListsThemInOrder()
    {
        var hotel = await CreateHotelAsync();
        var uploads = new[] { SmallPng(1), SmallPng(2), SmallPng(3) };

        foreach (var position in new[] { 2, 0, 1 })
        {
            var response = await administrator.PutAsync(ImageUrl(hotel.Id, position), Upload(uploads[position]));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(new ImageView("image/png", 40, 30, uploads[position].Length), await response.Content.ReadFromJsonAsync<ImageView>(Json));
        }

        for (var position = 0; position < 3; position++)
        {
            var download = await administrator.GetAsync(ImageUrl(hotel.Id, position));
            Assert.Equal(HttpStatusCode.OK, download.StatusCode);
            Assert.Equal(uploads[position], await download.Content.ReadAsByteArrayAsync());
            Assert.Equal("nosniff", Assert.Single(download.Headers.GetValues("X-Content-Type-Options")));
            Assert.NotNull(download.Headers.ETag);
        }

        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"));
        Assert.Equal([0, 1, 2], stored.Images.Select(image => image.Position));
        Assert.Equal(uploads.Select(bytes => bytes.Length), stored.Images.Select(image => image.SizeBytes));
        Assert.Equal(new ImageView("image/png", 40, 30, uploads[0].Length), stored.Image);
        Assert.Equal(3, StoredFiles().Length);
    }

    [Fact]
    public async Task AHotelWithoutImages_ExposesANullImageAndAnEmptyList()
    {
        var hotel = await CreateHotelAsync();

        using var document = JsonDocument.Parse(await (await administrator.GetAsync($"/api/hotels/{hotel.Id}")).Content.ReadAsStringAsync());

        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("image").ValueKind);
        Assert.Equal(0, document.RootElement.GetProperty("images").GetArrayLength());
    }

    [Fact]
    public async Task EachImage_IsSerializedWithItsPositionAndMetadata()
    {
        var hotel = await CreateHotelAsync();
        var png = SmallPng(4);
        await administrator.PutAsync(ImageUrl(hotel.Id, 1), Upload(png));

        using var document = JsonDocument.Parse(await (await administrator.GetAsync($"/api/hotels/{hotel.Id}")).Content.ReadAsStringAsync());

        var image = Assert.Single(document.RootElement.GetProperty("images").EnumerateArray().ToArray());
        Assert.Equal(["contentType", "height", "position", "sizeBytes", "width"], image.EnumerateObject().Select(property => property.Name).Order().ToArray());
        Assert.Equal(1, image.GetProperty("position").GetInt32());
        Assert.Equal(png.Length, image.GetProperty("sizeBytes").GetInt32());
        Assert.Equal(JsonValueKind.Null, document.RootElement.GetProperty("image").ValueKind);
    }

    [Fact]
    public async Task ReplacingAPosition_SwapsOnlyThatImageAndRemovesItsPreviousFile()
    {
        var hotel = await CreateHotelAsync();
        await UploadAllAsync(hotel.Id);
        var before = StoredFiles();
        var replacement = SmallPng(9);

        var response = await administrator.PutAsync(ImageUrl(hotel.Id, 1), Upload(replacement));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var after = StoredFiles();
        Assert.Equal(3, after.Length);
        Assert.Equal(2, after.Intersect(before).Count());
        Assert.Equal(replacement, await (await administrator.GetAsync(ImageUrl(hotel.Id, 1))).Content.ReadAsByteArrayAsync());
        Assert.Equal(SmallPng(1), await (await administrator.GetAsync(ImageUrl(hotel.Id, 0))).Content.ReadAsByteArrayAsync());
        Assert.Equal(SmallPng(3), await (await administrator.GetAsync(ImageUrl(hotel.Id, 2))).Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task RemovingAPosition_DoesNotShiftTheOthers()
    {
        var hotel = await CreateHotelAsync();
        await UploadAllAsync(hotel.Id);

        var response = await administrator.DeleteAsync(ImageUrl(hotel.Id, 0));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(hotel.Id, 0))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync($"/api/hotels/{hotel.Id}/image")).StatusCode);
        Assert.Equal(SmallPng(2), await (await administrator.GetAsync(ImageUrl(hotel.Id, 1))).Content.ReadAsByteArrayAsync());
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"));
        Assert.Null(stored.Image);
        Assert.Equal([1, 2], stored.Images.Select(image => image.Position));
        Assert.Equal(2, StoredFiles().Length);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.DeleteAsync(ImageUrl(hotel.Id, 0))).StatusCode);
    }

    [Fact]
    public async Task DeletingTheHotel_RemovesTheFileOfEveryPosition()
    {
        var hotel = await CreateHotelAsync();
        var survivor = await CreateHotelAsync();
        await UploadAllAsync(hotel.Id);
        await administrator.PutAsync(ImageUrl(survivor.Id, 2), Upload(SmallPng(7)));

        var response = await administrator.DeleteAsync($"/api/hotels/{hotel.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(StoredFiles());
        Assert.Equal(HttpStatusCode.OK, (await administrator.GetAsync(ImageUrl(survivor.Id, 2))).StatusCode);
    }

    [Fact]
    public async Task ARejectedUploadToAPosition_LeavesEveryImageAndFileUnchanged()
    {
        var hotel = await CreateHotelAsync();
        await UploadAllAsync(hotel.Id);
        var before = await (await administrator.GetAsync($"/api/hotels/{hotel.Id}")).Content.ReadAsStringAsync();
        var files = StoredFiles();

        var response = await administrator.PutAsync(ImageUrl(hotel.Id, 2), Upload(TestImages.Gif()));

        Assert.Equal(HttpStatusCode.UnsupportedMediaType, response.StatusCode);
        Assert.Equal(before, await (await administrator.GetAsync($"/api/hotels/{hotel.Id}")).Content.ReadAsStringAsync());
        Assert.Equal(files, StoredFiles());
    }

    [Theory]
    [InlineData(3)]
    [InlineData(-1)]
    public async Task APositionOutsideTheGallery_AnswersNotFoundProblemDetailsForEveryOperation(int position)
    {
        var hotel = await CreateHotelAsync();

        var responses = new[]
        {
            await administrator.PutAsync(ImageUrl(hotel.Id, position), Upload(SmallPng(1))),
            await administrator.GetAsync(ImageUrl(hotel.Id, position)),
            await administrator.DeleteAsync(ImageUrl(hotel.Id, position)),
            await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/images/{position}")
        };

        foreach (var response in responses)
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
            Assert.Equal(404, (await response.Content.ReadFromJsonAsync<ProblemView>(Json))!.Status);
        }

        Assert.Empty(StoredFiles());
        Assert.Empty((await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Images);
    }

    [Fact]
    public async Task UnknownHotels_AnswerNotFoundForEveryPositionOperation()
    {
        var unknown = Guid.CreateVersion7();

        Assert.Equal(HttpStatusCode.NotFound, (await administrator.PutAsync(ImageUrl(unknown, 1), Upload(SmallPng(1)))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(unknown, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.DeleteAsync(ImageUrl(unknown, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{unknown}/images/1")).StatusCode);
        Assert.Empty(StoredFiles());
    }

    [Fact]
    public async Task Anonymous_IsUnauthorizedOnEveryAdministrativePositionRoute()
    {
        var hotel = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id, 1), Upload(SmallPng(1)));
        var files = StoredFiles();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsync(ImageUrl(hotel.Id, 1), Upload(SmallPng(2)))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(ImageUrl(hotel.Id, 1))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync(ImageUrl(hotel.Id, 1))).StatusCode);
        Assert.Equal(files, StoredFiles());
    }

    [Fact]
    public async Task User_CanReadAPositionButCannotChangeIt()
    {
        var hotel = await CreateHotelAsync();
        var png = SmallPng(5);
        await administrator.PutAsync(ImageUrl(hotel.Id, 2), Upload(png));
        var files = StoredFiles();

        var put = await user.PutAsync(ImageUrl(hotel.Id, 2), Upload(SmallPng(6)));
        var delete = await user.DeleteAsync(ImageUrl(hotel.Id, 2));
        var get = await user.GetAsync(ImageUrl(hotel.Id, 2));

        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal(png, await get.Content.ReadAsByteArrayAsync());
        Assert.Equal(files, StoredFiles());
    }

    [Fact]
    public async Task TheSingleImageRoutes_ActOnPositionZero()
    {
        var hotel = await CreateHotelAsync();
        var primary = SmallPng(1);
        var replacement = SmallPng(8);

        Assert.Equal(HttpStatusCode.OK, (await administrator.PutAsync($"/api/hotels/{hotel.Id}/image", Upload(primary))).StatusCode);
        var legacy = await administrator.GetAsync($"/api/hotels/{hotel.Id}/image");
        var positioned = await administrator.GetAsync(ImageUrl(hotel.Id, 0));
        Assert.Equal(primary, await positioned.Content.ReadAsByteArrayAsync());
        Assert.Equal(legacy.Headers.ETag, positioned.Headers.ETag);
        Assert.Equal(legacy.Content.Headers.ContentType, positioned.Content.Headers.ContentType);

        await administrator.PutAsync(ImageUrl(hotel.Id, 0), Upload(replacement));
        Assert.Equal(replacement, await (await administrator.GetAsync($"/api/hotels/{hotel.Id}/image")).Content.ReadAsByteArrayAsync());
        Assert.Single(StoredFiles());

        Assert.Equal(HttpStatusCode.NoContent, (await administrator.DeleteAsync($"/api/hotels/{hotel.Id}/image")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(hotel.Id, 0))).StatusCode);
        Assert.Empty(StoredFiles());
    }

    [Fact]
    public async Task TheSingleImageRoutes_IgnoreAPositionInTheQueryString()
    {
        var hotel = await CreateHotelAsync();

        await administrator.PutAsync($"/api/hotels/{hotel.Id}/image?position=2", Upload(SmallPng(1)));

        Assert.Equal([0], (await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Images.Select(image => image.Position));
    }

    [Fact]
    public async Task Listing_ReturnsTheImagesOfEveryHotelOnThePage()
    {
        var first = await CreateHotelAsync($"Gallery A {Marker}");
        var second = await CreateHotelAsync($"Gallery B {Marker}");
        await UploadAllAsync(first.Id);
        await administrator.PutAsync(ImageUrl(second.Id, 2), Upload(SmallPng(4)));

        var page = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}"));
        var publicPage = await ReadPageAsync(await anonymous.GetAsync($"/api/public/hotels?name={Marker}"));

        foreach (var listed in new[] { page, publicPage })
        {
            Assert.Equal([0, 1, 2], listed.Items.Single(item => item.Id == first.Id).Images.Select(image => image.Position));
            Assert.Equal([2], listed.Items.Single(item => item.Id == second.Id).Images.Select(image => image.Position));
            Assert.Null(listed.Items.Single(item => item.Id == second.Id).Image);
        }
    }

    [Fact]
    public async Task PublicPositionRoute_ServesAnActiveHotelWithTheCachingHeaders()
    {
        var hotel = await CreateHotelAsync();
        var png = SmallPng(2);
        await administrator.PutAsync(ImageUrl(hotel.Id, 1), Upload(png));

        var response = await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/images/1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/png", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("nosniff", Assert.Single(response.Headers.GetValues("X-Content-Type-Options")));
        Assert.True(response.Headers.CacheControl?.Private);
        Assert.True(response.Headers.CacheControl?.NoCache);
        Assert.NotNull(response.Headers.ETag);
        Assert.Equal(png, await response.Content.ReadAsByteArrayAsync());
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/images/0")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/image")).StatusCode);
        var detail = await ReadHotelAsync(await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}"));
        Assert.Equal([1], detail.Images.Select(image => image.Position));
    }

    [Fact]
    public async Task PublicPositionRoute_HidesAnInactiveHotel()
    {
        var hotel = await CreateHotelAsync();
        await UploadAllAsync(hotel.Id);
        await DeactivateAsync(hotel.Id);

        for (var position = 0; position < 3; position++)
        {
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/images/{position}")).StatusCode);
            Assert.Equal(HttpStatusCode.OK, (await administrator.GetAsync(ImageUrl(hotel.Id, position))).StatusCode);
        }
    }

    private async Task UploadAllAsync(Guid hotelId)
    {
        for (var position = 0; position < 3; position++)
        {
            var response = await administrator.PutAsync(ImageUrl(hotelId, position), Upload(SmallPng(position + 1)));
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    private async Task DeactivateAsync(Guid hotelId)
    {
        using var scope = factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IHotelStore>();
        Assert.True(await store.SetActiveAsync(hotelId, false, DateTime.UtcNow, CancellationToken.None));
    }

    private static string ImageUrl(Guid hotelId, int position) => $"/api/hotels/{hotelId}/images/{position}";

    private static MultipartFormDataContent Upload(byte[] content)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("image/png");
        return new MultipartFormDataContent { { file, "image", "photo.png" } };
    }

    private string[] StoredFiles() =>
        Directory.Exists(factory.ImageRoot) ? Directory.GetFiles(factory.ImageRoot).Order().ToArray() : [];

    private async Task<HotelView> CreateHotelAsync(string? name = null)
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", new { name = name ?? $"Gallery {Marker} {Guid.NewGuid():N}" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadHotelAsync(response);
    }

    private static async Task<HotelView> ReadHotelAsync(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"Expected success, got {(int)response.StatusCode}.");
        return (await response.Content.ReadFromJsonAsync<HotelView>(Json))!;
    }

    private static async Task<HotelPageView> ReadPageAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelPageView>(Json))!;
    }

    private async Task<SignInView> SignInAsync(string email, string password)
    {
        var response = await anonymous.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SignInView>(Json))!;
    }

    private sealed record ImageView(string ContentType, int Width, int Height, int SizeBytes);

    private sealed record PositionedImageView(int Position, string ContentType, int Width, int Height, int SizeBytes);

    private sealed record HotelView(Guid Id, string Name, ImageView? Image, IReadOnlyList<PositionedImageView> Images);

    private sealed record HotelPageView(IReadOnlyList<HotelView> Items, int TotalItems);

    private sealed record ProblemView(int Status, string? Title);

    private sealed record SignInView(string AccessToken, Guid UserId);
}
