namespace HotelManagement.E2E.Tests;

public sealed class HotelApiServerFixture : IAsyncLifetime
{
    private readonly ApiServerFixture harness = new();

    public string AdministratorEmail => harness.AdministratorEmail;

    public string AdministratorPassword => harness.AdministratorPassword;

    public Uri BaseAddress => harness.BaseAddress;

    public HttpClient CreateClient() => new()
    {
        BaseAddress = harness.BaseAddress,
        Timeout = TimeSpan.FromSeconds(30)
    };

    public Dictionary<string, string> StartupSettings() => harness.StartupSettings();

    public Task<int> CountHotelsAsync(string name) => harness.CountHotelsAsync(name);

    public Task<string?> ReadHotelDescriptionAsync(Guid hotelId) => harness.ReadHotelDescriptionAsync(hotelId);

    public Task<string?> ReadHotelNameAsync(Guid hotelId) => harness.ReadHotelNameAsync(hotelId);

    public Task<IReadOnlyList<StoredRating>> ReadRatingsAsync(Guid hotelId) => harness.ReadRatingsAsync(hotelId);

    public Task InitializeAsync() => harness.StartAsync();

    public Task DisposeAsync() => harness.DisposeAsync().AsTask();
}

[CollectionDefinition(Name)]
public sealed class E2ECollection : ICollectionFixture<HotelApiServerFixture>
{
    public const string Name = "HotelApiE2E";
}
