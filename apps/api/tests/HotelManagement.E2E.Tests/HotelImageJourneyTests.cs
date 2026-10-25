using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using HotelManagement.Domain.Hotels;
using HotelManagement.TestSupport.Images;

namespace HotelManagement.E2E.Tests;

[Collection(E2ECollection.Name)]
public sealed class HotelImageJourneyTests(HotelApiServerFixture server)
{
    private const string GuestPassword = "Guest12345";

    [Fact]
    public async Task An_administrator_uploads_replaces_reads_and_removes_a_lossless_hotel_image()
    {
        using var client = await AdministratorClientAsync();
        var hotel = await CreateHotelAsync(client);
        var filesBefore = server.StoredImageFiles();

        var source = RgbaImage.Noise(48, 36, 5, sixteenBit: true, transparentRgb: true);
        var png = TestImages.Png(source, depth: 16);
        using var upload = await client.PutAsync(ImageUrl(hotel.Id), Upload(png));
        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var metadata = await upload.Content.ReadFromJsonAsync<HotelImageResponse>();
        Assert.Equal(new HotelImageResponse("image/png", 48, 36, png.Length), metadata);

        using var download = await client.GetAsync(ImageUrl(hotel.Id));
        Assert.Equal(HttpStatusCode.OK, download.StatusCode);
        Assert.Equal("image/png", download.Content.Headers.ContentType?.MediaType);
        var bytes = await download.Content.ReadAsByteArrayAsync();
        Assert.True(source.Samples.AsSpan().SequenceEqual(TestImages.Decode(bytes).Samples));

        using var single = await client.GetAsync($"/api/hotels/{hotel.Id}");
        Assert.Equal(metadata, (await single.Content.ReadFromJsonAsync<HotelResponse>())!.Image);
        using var list = await client.GetAsync($"/api/hotels?name={Uri.EscapeDataString(hotel.Name)}");
        Assert.Equal(metadata, (await list.Content.ReadFromJsonAsync<HotelPageResponse>())!.Items.Single().Image);
        Assert.Equal(filesBefore.Length + 1, server.StoredImageFiles().Length);

        var heavySource = RgbaImage.Gradient(400, 400, transparentRgb: true);
        var heavy = TestImages.Png(heavySource, compressionLevel: 0);
        Assert.True(heavy.Length > HotelImage.MaximumBytes);
        using var replacement = await client.PutAsync(ImageUrl(hotel.Id), Upload(heavy));
        Assert.Equal(HttpStatusCode.OK, replacement.StatusCode);
        var optimized = await (await client.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync();
        Assert.InRange(optimized.Length, 1, HotelImage.MaximumBytes);
        Assert.True(heavySource.Samples.AsSpan().SequenceEqual(TestImages.Decode(optimized).Samples));
        Assert.Equal(filesBefore.Length + 1, server.StoredImageFiles().Length);

        using var removal = await client.DeleteAsync(ImageUrl(hotel.Id));
        Assert.Equal(HttpStatusCode.NoContent, removal.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(filesBefore, server.StoredImageFiles());
    }

    [Fact]
    public async Task Rejected_uploads_over_a_real_server_leave_the_current_image_and_files_untouched()
    {
        using var client = await AdministratorClientAsync();
        var hotel = await CreateHotelAsync(client);
        var current = TestImages.Png(RgbaImage.Noise(30, 30, 8));
        (await client.PutAsync(ImageUrl(hotel.Id), Upload(current))).Dispose();
        var filesBefore = server.StoredImageFiles();

        var cases = new (byte[] Content, HttpStatusCode Expected)[]
        {
            (TestImages.Gif(), HttpStatusCode.UnsupportedMediaType),
            (TestImages.Png(RgbaImage.Noise(500, 500, 7)), HttpStatusCode.UnprocessableEntity),
            (TestImages.Png(RgbaImage.Gradient(200, 200))[..300], HttpStatusCode.BadRequest),
            (PngBytes.WithCorruptedCrc(TestImages.Png(RgbaImage.Gradient(3, 2)), "IEND"), HttpStatusCode.BadRequest),
            ([.. TestImages.Png(RgbaImage.Gradient(8, 8)), .. new byte[10 * 1024 * 1024]], HttpStatusCode.RequestEntityTooLarge)
        };

        foreach (var (content, expected) in cases)
        {
            using var response = await client.PutAsync(ImageUrl(hotel.Id), Upload(content));
            Assert.Equal(expected, response.StatusCode);
            Assert.Equal(filesBefore, server.StoredImageFiles());
            Assert.Equal(current, await (await client.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync());
        }
    }

    [Fact]
    public async Task A_png_declaring_its_color_keeps_the_declaration_after_lossless_recompression()
    {
        using var client = await AdministratorClientAsync();
        var hotel = await CreateHotelAsync(client);
        byte[] declaration = [9, 16, 0, 1];
        var heavy = PngBytes.OpaqueGrayRamp(400, 400, ("cICP", declaration));
        Assert.True(heavy.Length > HotelImage.MaximumBytes);

        using var upload = await client.PutAsync(ImageUrl(hotel.Id), Upload(heavy));

        Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        var stored = await (await client.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync();
        Assert.Equal(declaration, PngBytes.ChunkData(stored, "cICP"));
        Assert.InRange(stored.Length, 1, HotelImage.MaximumBytes);
    }

    [Fact]
    public async Task A_body_beyond_the_request_limit_is_cut_off_by_the_server_without_touching_anything()
    {
        using var client = await AdministratorClientAsync();
        var hotel = await CreateHotelAsync(client);
        var current = TestImages.Png(RgbaImage.Noise(30, 30, 10));
        (await client.PutAsync(ImageUrl(hotel.Id), Upload(current))).Dispose();
        var filesBefore = server.StoredImageFiles();

        HttpStatusCode? status = null;
        Exception? transportAbort = null;
        try
        {
            using var response = await client.PutAsync(ImageUrl(hotel.Id), Upload(new byte[12 * 1024 * 1024]));
            status = response.StatusCode;
        }
        catch (HttpRequestException exception)
        {
            transportAbort = exception;
        }

        if (transportAbort is null)
        {
            Assert.Equal(HttpStatusCode.RequestEntityTooLarge, status);
        }
        else
        {
            Assert.True(
                Flatten(transportAbort).Any(inner => inner is System.IO.IOException or System.Net.Sockets.SocketException),
                $"Expected a closed connection, got {transportAbort.GetType().Name}.");
        }

        Assert.True(server.IsProcessRunning);
        using var health = await server.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, health.StatusCode);
        Assert.Equal(filesBefore, server.StoredImageFiles());
        Assert.Equal(current, await (await client.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync());
        using var stored = await client.GetAsync($"/api/hotels/{hotel.Id}");
        Assert.Equal(new HotelImageResponse("image/png", 30, 30, current.Length), (await stored.Content.ReadFromJsonAsync<HotelResponse>())!.Image);
    }

    private static IEnumerable<Exception> Flatten(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException!)
        {
            yield return current;
            if (current.InnerException is null)
            {
                yield break;
            }
        }
    }

    [Fact]
    public async Task Users_and_anonymous_visitors_cannot_change_the_image_and_deleting_the_hotel_removes_it()
    {
        using var administrator = await AdministratorClientAsync();
        var hotel = await CreateHotelAsync(administrator);
        var png = TestImages.Png(RgbaImage.Noise(30, 30, 9));
        (await administrator.PutAsync(ImageUrl(hotel.Id), Upload(png))).Dispose();
        var filesBefore = server.StoredImageFiles();

        using var anonymous = server.CreateClient();
        using var guest = await GuestClientAsync();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.PutAsync(ImageUrl(hotel.Id), Upload(png))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.PutAsync(ImageUrl(hotel.Id), Upload(png))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await guest.DeleteAsync(ImageUrl(hotel.Id))).StatusCode);
        Assert.Equal(png, await (await guest.GetAsync(ImageUrl(hotel.Id))).Content.ReadAsByteArrayAsync());
        Assert.Equal(filesBefore, server.StoredImageFiles());

        using var deletion = await administrator.DeleteAsync($"/api/hotels/{hotel.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);
        Assert.Equal(filesBefore.Length - 1, server.StoredImageFiles().Length);
        Assert.Equal(HttpStatusCode.NotFound, (await administrator.GetAsync(ImageUrl(hotel.Id))).StatusCode);
    }

    [Fact]
    public async Task An_administrator_fills_three_positions_replaces_one_removes_one_and_deleting_the_hotel_leaves_no_files()
    {
        using var client = await AdministratorClientAsync();
        using var anonymous = server.CreateClient();
        var hotel = await CreateHotelAsync(client);
        var filesBefore = server.StoredImageFiles();
        var uploads = Enumerable.Range(0, 3).Select(seed => TestImages.Png(RgbaImage.Noise(32, 24, 40 + seed))).ToArray();

        for (var position = 0; position < uploads.Length; position++)
        {
            using var upload = await client.PutAsync(PositionUrl(hotel.Id, position), Upload(uploads[position]));
            Assert.Equal(HttpStatusCode.OK, upload.StatusCode);
        }

        Assert.Equal(filesBefore.Length + 3, server.StoredImageFiles().Length);
        var filled = await ReadHotelAsync(client, hotel.Id);
        Assert.Equal([0, 1, 2], filled.Images!.Select(image => image.Position));
        Assert.Equal(new HotelImageResponse("image/png", 32, 24, uploads[0].Length), filled.Image);
        Assert.Equal(uploads[2], await (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/images/2")).Content.ReadAsByteArrayAsync());
        Assert.Equal(uploads[0], await (await anonymous.GetAsync($"/api/public/hotels/{hotel.Id}/image")).Content.ReadAsByteArrayAsync());

        var replacement = TestImages.Png(RgbaImage.Noise(20, 20, 50));
        using (var replaced = await client.PutAsync(PositionUrl(hotel.Id, 1), Upload(replacement)))
        {
            Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        }

        Assert.Equal(replacement, await (await client.GetAsync(PositionUrl(hotel.Id, 1))).Content.ReadAsByteArrayAsync());
        Assert.Equal(filesBefore.Length + 3, server.StoredImageFiles().Length);

        using (var removal = await client.DeleteAsync(PositionUrl(hotel.Id, 2)))
        {
            Assert.Equal(HttpStatusCode.NoContent, removal.StatusCode);
        }

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(PositionUrl(hotel.Id, 2))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync(PositionUrl(hotel.Id, 3))).StatusCode);
        Assert.Equal([0, 1], (await ReadHotelAsync(client, hotel.Id)).Images!.Select(image => image.Position));
        Assert.Equal(filesBefore.Length + 2, server.StoredImageFiles().Length);

        using var deletion = await client.DeleteAsync($"/api/hotels/{hotel.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);
        Assert.Equal(filesBefore, server.StoredImageFiles());
    }

    private static async Task<HotelResponse> ReadHotelAsync(HttpClient client, Guid hotelId)
    {
        using var response = await client.GetAsync($"/api/hotels/{hotelId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelResponse>())!;
    }

    private static string PositionUrl(Guid hotelId, int position) => $"/api/hotels/{hotelId}/images/{position}";

    private static string ImageUrl(Guid hotelId) => $"/api/hotels/{hotelId}/image";

    private static MultipartFormDataContent Upload(byte[] content)
    {
        var file = new ByteArrayContent(content);
        file.Headers.ContentType = new MediaTypeHeaderValue("application/octet-stream");
        return new MultipartFormDataContent { { file, "image", "upload.bin" } };
    }

    private async Task<HttpClient> AdministratorClientAsync()
    {
        var client = server.CreateClient();
        var session = await SignInAsync(client, server.AdministratorEmail, server.AdministratorPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return client;
    }

    private async Task<HttpClient> GuestClientAsync()
    {
        var client = server.CreateClient();
        var email = $"guest-{Guid.NewGuid():N}@hotels.test";
        using var registration = await client.PostAsJsonAsync("/api/auth/register", new { email, password = GuestPassword });
        Assert.Equal(HttpStatusCode.Created, registration.StatusCode);
        var session = await SignInAsync(client, email, GuestPassword);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", session.AccessToken);
        return client;
    }

    private static async Task<HotelResponse> CreateHotelAsync(HttpClient client)
    {
        using var response = await client.PostAsJsonAsync("/api/hotels", new { name = $"Imaged {Guid.NewGuid():N}" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<HotelResponse>())!;
    }

    private static async Task<SignInResponse> SignInAsync(HttpClient client, string email, string password)
    {
        using var response = await client.PostAsJsonAsync("/api/auth/login", new { email, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<SignInResponse>())!;
    }
}
