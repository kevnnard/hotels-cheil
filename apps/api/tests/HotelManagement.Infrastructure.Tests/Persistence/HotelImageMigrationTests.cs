using HotelManagement.Domain.Hotels;
using HotelManagement.Infrastructure.Persistence;
using HotelManagement.TestSupport.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelImageMigrationTests(PostgresDatabaseFixture database)
{
    private const string SingleImageMigration = "20261024014601_AddHotelImage";
    private const string ImagelessMigration = "20261023180105_AddIdentitySupport";

    private static readonly string PngKey = new string('a', 32) + ".png";
    private static readonly string WebPKey = new string('b', 32) + ".webp";

    private static async Task MigrateAsync(ScratchDatabase scratch, string? target = null)
    {
        await using var context = scratch.CreateContext();
        await context.GetService<IMigrator>().MigrateAsync(target);
    }

    private static Task InsertHotelAsync(ScratchDatabase scratch, Guid id, string name, string imageValues) =>
        scratch.ExecuteAsync(
            "INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc, image_storage_key, image_content_type, image_width, image_height, image_size_bytes) "
            + $"VALUES ('{id}', '{name}', true, now(), now(), {imageValues})");

    [Fact]
    public async Task UpgradingADatabaseHoldingSingleImages_MovesEachImageToPositionZeroAndDropsTheOldColumns()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch, SingleImageMigration);
        var pictured = Guid.NewGuid();
        var plain = Guid.NewGuid();
        var other = Guid.NewGuid();
        await InsertHotelAsync(scratch, pictured, "Pictured", $"'{PngKey}', 'image/png', 640, 480, 123456");
        await InsertHotelAsync(scratch, plain, "Plain", "NULL, NULL, NULL, NULL, NULL");
        await InsertHotelAsync(scratch, other, "Other", $"'{WebPKey}', 'image/webp', 1, 2, 400000");

        await MigrateAsync(scratch);

        var rows = await scratch.QueryAsync(
            "SELECT hotel_id, position, storage_key, content_type, width, height, size_bytes FROM hotel_images ORDER BY storage_key");
        Assert.Equal(2, rows.Count);
        Assert.Equal([pictured, 0, PngKey, "image/png", 640, 480, 123456], rows[0]);
        Assert.Equal([other, 0, WebPKey, "image/webp", 1, 2, 400000], rows[1]);
        Assert.Empty(await scratch.QueryAsync(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'hotels' AND column_name LIKE 'image%'"));
        Assert.Equal(3, (await scratch.QueryAsync("SELECT id FROM hotels")).Count);

        var store = new PostgresHotelStore(scratch.CreateContext());
        Assert.Equal(new HotelImage(PngKey, "image/png", 640, 480, 123456), (await store.FindAsync(pictured, CancellationToken.None))!.Image);
        Assert.Null((await store.FindAsync(plain, CancellationToken.None))!.Image);

        await using var context = scratch.CreateContext();
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
        Assert.False(context.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task UpgradingADatabaseHoldingPartialImageColumns_CopiesOnlyCompleteImagesAndKeepsEveryHotel()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch, SingleImageMigration);
        var complete = Guid.NewGuid();
        var partial = Guid.NewGuid();
        await InsertHotelAsync(scratch, complete, "Complete", $"'{PngKey}', 'image/png', 640, 480, 123456");
        await InsertHotelAsync(scratch, partial, "Partial", $"'{WebPKey}', 'image/webp', NULL, 2, 300");

        await MigrateAsync(scratch);

        var rows = await scratch.QueryAsync(
            "SELECT hotel_id, position, storage_key, content_type, width, height, size_bytes FROM hotel_images");
        Assert.Equal([complete, 0, PngKey, "image/png", 640, 480, 123456], Assert.Single(rows));
        Assert.Equal(2, (await scratch.QueryAsync($"SELECT id FROM hotels WHERE id IN ('{complete}', '{partial}')")).Count);
        Assert.Empty(await scratch.QueryAsync(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'hotels' AND column_name LIKE 'image%'"));
        Assert.Null((await new PostgresHotelStore(scratch.CreateContext()).FindAsync(partial, CancellationToken.None))!.Image);
    }

    [Fact]
    public async Task MigratingAnEmptyDatabase_CreatesTheImageTableWithItsConstraints()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();

        await MigrateAsync(scratch);

        var hotel = Guid.NewGuid();
        await scratch.ExecuteAsync($"INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc) VALUES ('{hotel}', 'Empty', true, now(), now())");
        await scratch.ExecuteAsync(ImageInsert(hotel, 0, PngKey, 400000));
        await scratch.ExecuteAsync(ImageInsert(hotel, 2, WebPKey, 1));

        Assert.Equal("23514", await SqlStateOfAsync(scratch, ImageInsert(hotel, 3, new string('c', 32) + ".png", 1)));
        Assert.Equal("23514", await SqlStateOfAsync(scratch, ImageInsert(hotel, -1, new string('c', 32) + ".png", 1)));
        Assert.Equal("23514", await SqlStateOfAsync(scratch, ImageInsert(hotel, 1, new string('c', 32) + ".png", 400001)));
        Assert.Equal("23505", await SqlStateOfAsync(scratch, ImageInsert(hotel, 0, new string('d', 32) + ".png", 1)));
        Assert.Equal("23505", await SqlStateOfAsync(scratch, ImageInsert(hotel, 1, PngKey, 1)));
        Assert.Equal("23503", await SqlStateOfAsync(scratch, ImageInsert(Guid.NewGuid(), 0, new string('e', 32) + ".png", 1)));

        await scratch.ExecuteAsync($"DELETE FROM hotels WHERE id = '{hotel}'");
        Assert.Empty(await scratch.QueryAsync("SELECT storage_key FROM hotel_images"));
        Assert.Empty(await scratch.QueryAsync(
            "SELECT column_name FROM information_schema.columns WHERE table_name = 'hotels' AND column_name LIKE 'image%'"));
    }

    [Fact]
    public async Task UpgradingFromTheSchemaWithoutImages_KeepsExistingHotelsValidAndImageless()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch, ImagelessMigration);
        var hotelId = Guid.NewGuid();
        await scratch.ExecuteAsync(
            $"INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc) VALUES ('{hotelId}', 'Legacy Hotel', true, now(), now())");

        await MigrateAsync(scratch);

        var restored = (await new PostgresHotelStore(scratch.CreateContext()).FindAsync(hotelId, CancellationToken.None))!;
        Assert.Equal("Legacy Hotel", restored.Details.Name);
        Assert.Null(restored.Image);
        Assert.Empty(await scratch.QueryAsync("SELECT storage_key FROM hotel_images"));
    }

    [Fact]
    public async Task TheGalleryMigration_IsForwardOnly()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch);

        await Assert.ThrowsAsync<NotSupportedException>(() => MigrateAsync(scratch, SingleImageMigration));
    }

    private static string ImageInsert(Guid hotelId, int position, string key, int sizeBytes) =>
        "INSERT INTO hotel_images (hotel_id, position, storage_key, content_type, width, height, size_bytes) "
        + $"VALUES ('{hotelId}', {position}, '{key}', 'image/png', 10, 10, {sizeBytes})";

    private static async Task<string?> SqlStateOfAsync(ScratchDatabase scratch, string sql)
    {
        try
        {
            await scratch.ExecuteAsync(sql);
            return null;
        }
        catch (PostgresException exception)
        {
            return exception.SqlState;
        }
    }
}
