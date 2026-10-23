using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Api.Tests;

public sealed class HotelApiFixture : IAsyncLifetime
{
    private readonly PostgresDatabaseFixture database = new();
    private HotelApiFactory? factory;

    public string ConnectionString => database.ConnectionString;

    public HttpClient CreateClient() => Factory.CreateClient();

    public IServiceProvider Services => Factory.Services;

    private HotelApiFactory Factory => factory ?? throw new InvalidOperationException("The fixture is not initialized.");

    public async Task InitializeAsync()
    {
        await database.InitializeAsync();
        factory = new HotelApiFactory(database.ConnectionString);
    }

    public async Task DisposeAsync()
    {
        if (factory is not null)
        {
            await factory.DisposeAsync();
        }

        await database.DisposeAsync();
    }
}

[CollectionDefinition(Name)]
public sealed class HotelApiCollection : ICollectionFixture<HotelApiFixture>
{
    public const string Name = "HotelApi";
}
