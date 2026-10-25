using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using HotelManagement.Domain.Hotels;
using HotelManagement.TestSupport.Images;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using HotelManagement.Application.Persistence;

namespace HotelManagement.Api.Tests.Hotels;

[Collection(HotelApiCollection.Name)]
public class HotelImageEndpointsTests(HotelApiFixture api) : IAsyncLifetime
{
    private const string AdministratorEmail = "admin@example.com";
    private const string AdministratorPassword = "Admin12345";
    private const string UserPassword = "abcd1234";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private HotelApiFactory factory = null!;
    private HttpClient anonymous = null!;
    private HttpClient administrator = null!;
    private HttpClient user = null!;
    private Guid userId;

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
        userId = userToken.UserId;
        user.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", userToken.AccessToken);
    }

    public async Task DisposeAsync()
    {
        anonymous.Dispose();
        administrator.Dispose();
        user.Dispose();
        await factory.DisposeAsync();
    }

    private static byte[] SmallPng(int seed = 1) => TestImages.Png(RgbaImage.Noise(40, 30, seed, sixteenBit: true), depth: 16);

    [Fact]
    public async Task Put_StoresTheImageAndEveryReadReturnsItsMetadataAndDecodedBytes()
    {
        var hotel = await CreateHotelAsync();
        var source = RgbaImage.Noise(40, 30, 1, sixteenBit: true, transparentRgb: true);
        var png = TestImages.Png(source, depth: 16);

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(png));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var image = (await response.Content.ReadFromJsonAsync<ImageView>(Json))!;
        Assert.Equal(new ImageView("image/png", 40, 30, png.Length), image);

        foreach (var client in new[] { administrator, user })
        {
            var download = await client.GetAsync(ImageUrl(hotel.Id));
            Assert.Equal(HttpStatusCode.OK, download.StatusCode);
            Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
            Assert.Equal("nosniff", Assert.Single(download.Headers.GetValues("X-Content-Type-Options")));
            Assert.NotNull(download.Headers.ETag);
            var bytes = await download.Content.ReadAsByteArrayAsync();
            Assert.Equal(png, bytes);
            var decoded = TestImages.Decode(bytes);
            Assert.Equal((40, 30), (decoded.Width, decoded.Height));
            Assert.True(source.Samples.AsSpan().SequenceEqual(decoded.Samples));
        }

        Assert.Equal(image, (await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Image);
        Assert.Single(StoredFiles());
    }

    [Fact]
    public async Task Put_KeepsTheDecodedPixelsOfAnOversizedCompressibleImageWithinTheBudget()
    {
        var hotel = await CreateHotelAsync();
        var source = RgbaImage.Gradient(400, 400, transparentRgb: true);
        var heavy = TestImages.Png(source, compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(heavy));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var image = (await response.Content.ReadFromJsonAsync<ImageView>(Json))!;
        var bytes = await (await administrator.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync();
        Assert.InRange(bytes.Length, 1, HotelImage.MaximumBytes);
        Assert.Equal(bytes.Length, image.SizeBytes);
        var decoded = TestImages.Decode(bytes);
        Assert.Equal((400, 400), (decoded.Width, decoded.Height));
        Assert.True(source.Samples.AsSpan().SequenceEqual(decoded.Samples));
    }

    [Fact]
    public async Task Put_KeepsTheDeclaredColorInterpretationOfAnOversizedPng()
    {
        var hotel = await CreateHotelAsync();
        byte[] declaration = [9, 16, 0, 1];
        var source = RgbaImage.Gradient(400, 400);
        var heavy = PngBytes.WithChunk(TestImages.Png(source, compressionLevel: 0), "cICP", declaration);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(heavy));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var bytes = await (await administrator.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync();
        Assert.Equal(declaration, PngBytes.ChunkData(bytes, "cICP"));
        Assert.True(source.Samples.AsSpan().SequenceEqual(TestImages.Decode(bytes).Samples));
    }

    [Fact]
    public async Task Put_ReplacesTheImageAndRemovesThePreviousFile()
    {
        var hotel = await CreateHotelAsync();
        var first = SmallPng(1);
        var second = TestImages.Jpeg(RgbaImage.Gradient(64, 48));
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(first));
        var firstFiles = StoredFiles();

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(second, "photo.jpg", "image/jpeg"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(second, await (await administrator.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync());
        var files = StoredFiles();
        Assert.Single(files);
        Assert.NotEqual(firstFiles, files);
        Assert.Equal(new ImageView("image/jpeg", 64, 48, second.Length), (await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Image);
    }

    [Fact]
    public async Task Put_TrustsTheContentNotTheFileNameOrDeclaredType()
    {
        var hotel = await CreateHotelAsync();
        var jpeg = TestImages.Jpeg(RgbaImage.Gradient(32, 32));

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(jpeg, "../../evil.png", "image/png"));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("image/jpeg", (await response.Content.ReadFromJsonAsync<ImageView>(Json))!.ContentType);
        var file = Assert.Single(StoredFiles());
        Assert.Matches("^[0-9a-f]{32}\\.jpg$", Path.GetFileName(file));
        Assert.Equal(factory.ImageRoot, Path.GetDirectoryName(file));
    }

    public static TheoryData<string, HttpStatusCode> Rejections => new()
    {
        { "random", HttpStatusCode.UnsupportedMediaType },
        { "gif", HttpStatusCode.UnsupportedMediaType },
        { "animated-webp", HttpStatusCode.UnsupportedMediaType },
        { "truncated-png", HttpStatusCode.BadRequest },
        { "corrupt-iend-crc", HttpStatusCode.BadRequest },
        { "empty", HttpStatusCode.BadRequest },
        { "too-heavy", HttpStatusCode.UnprocessableEntity },
        { "too-wide", HttpStatusCode.UnprocessableEntity },
        { "cmyk", HttpStatusCode.UnprocessableEntity },
        { "too-large-upload", HttpStatusCode.RequestEntityTooLarge }
    };

    [Theory]
    [MemberData(nameof(Rejections))]
    public async Task Put_RejectsUnacceptableContentAndLeavesTheHotelImageAndFilesUnchanged(string kind, HttpStatusCode expected)
    {
        var hotel = await CreateHotelAsync();
        var current = SmallPng(2);
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(current));
        var before = await SnapshotAsync(hotel.Id);
        var filesBefore = StoredFiles();

        var response = await administrator.PutAsync(ImageUrl(hotel.Id), Upload(Rejected(kind)));

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(before, await SnapshotAsync(hotel.Id));
        Assert.Equal(filesBefore, StoredFiles());
        Assert.Equal(current, await (await administrator.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync());
    }

    [Fact]
    public async Task Put_WithoutTheImageFieldOrWithAnotherBodyType_IsRejectedWithoutChanges()
    {
        var hotel = await CreateHotelAsync();
        var before = await SnapshotAsync(hotel.Id);

        var wrongField = new MultipartFormDataContent { { new ByteArrayContent(SmallPng()), "photo", "photo.png" } };
        var missing = await administrator.PutAsync(ImageUrl(hotel.Id), wrongField);
        var json = await administrator.PutAsJsonAsync(ImageUrl(hotel.Id), new { image = "abc" });

        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        Assert.Contains("image", (await missing.Content.ReadFromJsonAsync<ProblemView>(Json))!.Errors.Keys);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, json.StatusCode);
        Assert.Equal(before, await SnapshotAsync(hotel.Id));
        Assert.Empty(StoredFiles());
    }

    [Fact]
    public async Task UnknownHotels_AnswerNotFoundForEveryImageOperationAndStoreNothing()
    {
        var unknown = Guid.CreateVersion7();

        Assert.Equal(HttpStatusCode.NotFound, (await administrator.PutAsync(ImageUrl(unknown), Upload(SmallPng()))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(unknown))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.DeleteAsync(ImageUrl(unknown))).StatusCode);
        Assert.Empty(StoredFiles());
    }

    [Fact]
    public async Task Get_AndDeleteAnswerNotFoundForAHotelWithoutAnImage()
    {
        var hotel = await CreateHotelAsync();
        var before = await SnapshotAsync(hotel.Id);

        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.DeleteAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(before, await SnapshotAsync(hotel.Id));
    }

    [Fact]
    public async Task Delete_RemovesTheAssociationAndTheFile()
    {
        var hotel = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng()));

        var response = await administrator.DeleteAsync(ImageUrl(hotel.Id));

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Null((await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Image);
        Assert.Empty(StoredFiles());
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.DeleteAsync(ImageUrl(hotel.Id))).StatusCode);
    }

    [Fact]
    public async Task DeletingTheHotel_RemovesItsImageFile()
    {
        var hotel = await CreateHotelAsync();
        var survivor = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng(1)));
        await administrator.PutAsync(ImageUrl(survivor.Id), Upload(SmallPng(2)));

        var response = await administrator.DeleteAsync($"/api/hotels/{hotel.Id}");

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Single(StoredFiles());
        Assert.Equal(HttpStatusCode.OK, (await administrator.GetAsync(ImageUrl(survivor.Id))).StatusCode);
    }

    [Fact]
    public async Task ListAndSingleReads_ExposeTheImageMetadataAndKeepFiltersAndPagination()
    {
        var withImage = await CreateHotelAsync($"Pictured {Marker}");
        var withoutImage = await CreateHotelAsync($"Plain {Marker}");
        await administrator.PutAsync(ImageUrl(withImage.Id), Upload(SmallPng()));
        await RateAsync(withImage.Id, 4m);

        var all = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}"));
        var rated = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&minRating=3"));
        var firstPage = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&pageSize=1&page=1"));
        var secondPage = await ReadPageAsync(await administrator.GetAsync($"/api/hotels?name={Marker}&pageSize=1&page=2"));

        Assert.Equal([withImage.Id, withoutImage.Id], all.Items.Select(item => item.Id));
        Assert.NotNull(all.Items[0].Image);
        Assert.Null(all.Items[1].Image);
        Assert.Equal(withImage.Id, Assert.Single(rated.Items).Id);
        Assert.NotNull(rated.Items[0].Image);
        Assert.Equal((2, 2), (firstPage.TotalItems, secondPage.TotalItems));
        Assert.NotNull(firstPage.Items.Single().Image);
        Assert.Null(secondPage.Items.Single().Image);
    }

    [Fact]
    public async Task MetadataUpdatesAndRatings_PreserveTheImage()
    {
        var hotel = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng()));
        var expected = (await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"))).Image;
        var filesBefore = StoredFiles();

        var update = await administrator.PutAsJsonAsync($"/api/hotels/{hotel.Id}", Body($"Renamed {Marker}"));
        await RateAsync(hotel.Id, 5m);

        Assert.Equal(HttpStatusCode.OK, update.StatusCode);
        Assert.Equal(expected, (await ReadHotelAsync(update)).Image);
        var stored = await ReadHotelAsync(await administrator.GetAsync($"/api/hotels/{hotel.Id}"));
        Assert.Equal($"Renamed {Marker}", stored.Name);
        Assert.Equal(expected, stored.Image);
        Assert.Equal(5m, stored.Rating.Average);
        Assert.Equal(filesBefore, StoredFiles());
    }

    [Fact]
    public async Task NameOnlyJsonCreation_StillWorksAndHasNoImage()
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", new { name = $"Minimal {Marker}" });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await ReadHotelAsync(response);
        Assert.Null(created.Image);
        Assert.EndsWith($"/api/hotels/{created.Id}", response.Headers.Location!.ToString());
    }

    [Fact]
    public async Task Anonymous_IsUnauthorizedAndNothingChanges()
    {
        var hotel = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng()));
        var before = await SnapshotAsync(hotel.Id);
        var filesBefore = StoredFiles();

        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng(9)))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.DeleteAsync(ImageUrl(hotel.Id))).StatusCode);

        Assert.Equal(before, await SnapshotAsync(hotel.Id));
        Assert.Equal(filesBefore, StoredFiles());
    }

    [Fact]
    public async Task User_CanReadButCannotChangeTheImage()
    {
        var hotel = await CreateHotelAsync();
        var png = SmallPng();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(png));
        var before = await SnapshotAsync(hotel.Id);
        var filesBefore = StoredFiles();

        var put = await user.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng(9)));
        var delete = await user.DeleteAsync(ImageUrl(hotel.Id));
        var get = await user.GetAsync(ImageUrl(hotel.Id));

        Assert.Equal(HttpStatusCode.Forbidden, put.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, delete.StatusCode);
        Assert.Equal(HttpStatusCode.OK, get.StatusCode);
        Assert.Equal(png, await get.Content.ReadAsByteArrayAsync());
        Assert.Equal(before, await SnapshotAsync(hotel.Id));
        Assert.Equal(filesBefore, StoredFiles());
    }

    [Fact]
    public async Task TheStorageDirectoryIsNeverServedStatically()
    {
        var hotel = await CreateHotelAsync();
        await administrator.PutAsync(ImageUrl(hotel.Id), Upload(SmallPng()));
        var name = Path.GetFileName(Assert.Single(StoredFiles()));

        foreach (var path in new[] { $"/{name}", $"/images/{name}", $"/storage/{name}", $"/api/images/{name}" })
        {
            Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync(path)).StatusCode);
            Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(path)).StatusCode);
        }
    }

    private byte[] Rejected(string kind) => kind switch
    {
        "random" => [.. Enumerable.Range(0, 4096).Select(index => (byte)(index * 31 + 7))],
        "gif" => TestImages.Gif(),
        "animated-webp" => TestImages.AnimatedWebP(RgbaImage.Gradient(32, 32), RgbaImage.Noise(32, 32, 4)),
        "truncated-png" => TestImages.Png(RgbaImage.Gradient(200, 200))[..400],
        "corrupt-iend-crc" => PngBytes.WithCorruptedCrc(TestImages.Png(RgbaImage.Gradient(3, 2)), "IEND"),
        "empty" => [],
        "too-heavy" => TestImages.Png(RgbaImage.Noise(500, 500, 7)),
        "too-wide" => PngBytes.Declaring(4097, 1),
        "cmyk" => TestImages.CmykJpeg(RgbaImage.Gradient(64, 64)),
        "too-large-upload" => [.. TestImages.Png(RgbaImage.Gradient(8, 8)), .. new byte[10 * 1024 * 1024]],
        _ => throw new ArgumentOutOfRangeException(nameof(kind))
    };

    private static string ImageUrl(Guid hotelId) => $"/api/hotels/{hotelId}/image";

    private static MultipartFormDataContent Upload(byte[] content, string fileName = "photo.png", string contentType = "image/png")
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        return new MultipartFormDataContent { { file, "image", fileName } };
    }

    private string[] StoredFiles() =>
        Directory.Exists(factory.ImageRoot) ? Directory.GetFiles(factory.ImageRoot).Order().ToArray() : [];

    private async Task<HotelView> CreateHotelAsync(string? name = null)
    {
        var response = await administrator.PostAsJsonAsync("/api/hotels", Body(name ?? $"Imaged {Marker}"));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await ReadHotelAsync(response);
    }

    private async Task RateAsync(Guid hotelId, decimal score)
    {
        using var scope = factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<IHotelRatingsStore>().RateAsync(hotelId, userId, score, CancellationToken.None);
    }

    private async Task<string> SnapshotAsync(Guid hotelId)
    {
        await using var connection = new NpgsqlConnection(api.ConnectionString);
        await connection.OpenAsync();
        await using var command = new NpgsqlCommand(
            "SELECT coalesce(to_jsonb(h), 'null'::jsonb)::text FROM hotels h WHERE h.id = @id",
            connection);
        command.Parameters.AddWithValue("id", hotelId);
        return (string?)await command.ExecuteScalarAsync() ?? "<missing>";
    }

    private static HotelBody Body(string name) => new(
        name,
        "A quiet hotel",
        "1 Main Street",
        "Lisbon",
        "Lisbon District",
        "Portugal",
        "1000-001",
        "+351210000000",
        "front@example.com",
        "https://hotel.example.com");

    private static async Task<HotelView> ReadHotelAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<HotelView>(Json))!;

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

    private sealed record HotelBody(
        string? Name,
        string? Description,
        string? Street,
        string? City,
        string? Region,
        string? Country,
        string? PostalCode,
        string? Phone,
        string? Email,
        string? Website);

    private sealed record ImageView(string ContentType, int Width, int Height, int SizeBytes);

    private sealed record RatingView(decimal Sum, int Count, decimal? Average);

    private sealed record HotelView(Guid Id, string Name, RatingView Rating, ImageView? Image);

    private sealed record HotelPageView(IReadOnlyList<HotelView> Items, int Page, int PageSize, int TotalItems, int TotalPages);

    private sealed record ProblemView(Dictionary<string, string[]> Errors);

    private sealed record SignInView(string AccessToken, Guid UserId);
}
