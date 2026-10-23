using HotelManagement.Application.Persistence;
using HotelManagement.Domain.Hotels;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class PersistenceWiringTests(PostgresDatabaseFixture database)
{
    [Fact]
    public async Task RegisteredStore_PersistsHotelsThroughTheConfiguredDatabase()
    {
        var services = new ServiceCollection().AddHotelPersistence(database.ConnectionString);
        await using var provider = services.BuildServiceProvider();
        var hotel = Hotel.Create(new HotelDetails("Wired Hotel"), new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc));

        await using (var scope = provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<IHotelStore>().AddAsync(hotel, CancellationToken.None);
        }

        await using var readScope = provider.CreateAsyncScope();
        var restored = await readScope.ServiceProvider.GetRequiredService<IHotelStore>()
            .FindAsync(hotel.Id, CancellationToken.None);
        Assert.Equal("Wired Hotel", restored?.Details.Name);
    }

    [Fact]
    public async Task RegisteredRatingsStore_RatesThroughTheConfiguredDatabase()
    {
        var services = new ServiceCollection().AddHotelPersistence(database.ConnectionString);
        await using var provider = services.BuildServiceProvider();
        var hotel = Hotel.Create(new HotelDetails("Wired Ratings"), new DateTime(2026, 10, 23, 12, 0, 0, DateTimeKind.Utc));
        var userId = Guid.NewGuid();

        await using (var scope = provider.CreateAsyncScope())
        {
            await scope.ServiceProvider.GetRequiredService<IHotelStore>().AddAsync(hotel, CancellationToken.None);
            var summary = await scope.ServiceProvider.GetRequiredService<IHotelRatingsStore>()
                .RateAsync(hotel.Id, userId, 4m, CancellationToken.None);
            Assert.Equal(1, summary?.Count);
        }

        await using var readScope = provider.CreateAsyncScope();
        var stored = await readScope.ServiceProvider.GetRequiredService<IHotelRatingsStore>()
            .GetSummaryAsync(hotel.Id, CancellationToken.None);
        Assert.Equal(4m, stored?.Average);
    }

    [Fact]
    public void BlankConnectionString_IsRejected()
    {
        Assert.Throws<ArgumentException>(() => new ServiceCollection().AddHotelPersistence(" "));
    }

    [Fact]
    public async Task MigrationsMatchTheModel()
    {
        await using var context = database.CreateContext();

        Assert.False(context.Database.HasPendingModelChanges());
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
    }
}
