using HotelManagement.Infrastructure.Persistence;
using HotelManagement.TestSupport.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[Collection(PostgresCollection.Name)]
public class HotelPricingMigrationTests(PostgresDatabaseFixture database)
{
    private const string GalleryMigration = "20261025195557_AddHotelImageGallery";
    private const string CheckViolation = "23514";

    private static async Task MigrateAsync(ScratchDatabase scratch, string? target = null)
    {
        await using var context = scratch.CreateContext();
        await context.GetService<IMigrator>().MigrateAsync(target);
    }

    [Fact]
    public async Task UpgradingADatabaseHoldingHotels_KeepsThemIntactWithoutPricing()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch, GalleryMigration);
        var hotelId = Guid.NewGuid();
        await scratch.ExecuteAsync(
            "INSERT INTO hotels (id, name, description, city, email, is_active, created_at_utc, updated_at_utc) "
            + $"VALUES ('{hotelId}', 'Legacy Hotel', 'Old wing', 'Lisbon', 'front@example.com', true, '2026-10-01T08:00:00Z', '2026-10-02T08:00:00Z')");

        await MigrateAsync(scratch);

        var row = Assert.Single(await scratch.QueryAsync(
            $"SELECT name, description, city, email, is_active, price_per_night, discount_percent FROM hotels WHERE id = '{hotelId}'"));
        Assert.Equal(["Legacy Hotel", "Old wing", "Lisbon", "front@example.com", true, null, null], row);

        var restored = (await new PostgresHotelStore(scratch.CreateContext()).FindAsync(hotelId, CancellationToken.None))!;
        Assert.Equal("Legacy Hotel", restored.Details.Name);
        Assert.Null(restored.Details.Pricing);
        Assert.Equal(new DateTime(2026, 10, 2, 8, 0, 0, DateTimeKind.Utc), restored.UpdatedAtUtc);

        await using var context = scratch.CreateContext();
        Assert.Empty(await context.Database.GetPendingMigrationsAsync());
        Assert.False(context.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task ThePricingColumns_HaveTheExpectedTypes()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch);

        var columns = await scratch.QueryAsync(
            "SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable FROM information_schema.columns "
            + "WHERE table_name = 'hotels' AND column_name IN ('price_per_night', 'discount_percent') ORDER BY column_name");

        Assert.Equal(2, columns.Count);
        Assert.Equal(["discount_percent", "smallint", 16, 0, "YES"], columns[0]);
        Assert.Equal(["price_per_night", "numeric", 10, 2, "YES"], columns[1]);
    }

    [Theory]
    [InlineData("NULL", "NULL", null)]
    [InlineData("0.01", "NULL", null)]
    [InlineData("100000", "90", null)]
    [InlineData("120.50", "1", null)]
    [InlineData("NULL", "10", CheckViolation)]
    [InlineData("0", "NULL", CheckViolation)]
    [InlineData("-1", "NULL", CheckViolation)]
    [InlineData("100000.01", "NULL", CheckViolation)]
    [InlineData("100", "0", CheckViolation)]
    [InlineData("100", "91", CheckViolation)]
    [InlineData("NULL", "0", CheckViolation)]
    public async Task TheDatabaseChecks_EnforceThePricingRules(string price, string discount, string? expectedState)
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch);

        var state = await SqlStateOfAsync(
            scratch,
            "INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc, price_per_night, discount_percent) "
            + $"VALUES ('{Guid.NewGuid()}', 'Checked', true, now(), now(), {price}, {discount})");

        Assert.Equal(expectedState, state);
    }

    [Fact]
    public async Task ClearingThePriceOfADiscountedHotel_IsRejected()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch);
        var hotelId = Guid.NewGuid();
        await scratch.ExecuteAsync(
            "INSERT INTO hotels (id, name, is_active, created_at_utc, updated_at_utc, price_per_night, discount_percent) "
            + $"VALUES ('{hotelId}', 'Discounted', true, now(), now(), 200, 20)");

        Assert.Equal(CheckViolation, await SqlStateOfAsync(scratch, $"UPDATE hotels SET price_per_night = NULL WHERE id = '{hotelId}'"));
    }

    [Fact]
    public async Task ThePricingMigration_IsForwardOnly()
    {
        await using var scratch = await database.CreateScratchDatabaseAsync();
        await MigrateAsync(scratch);

        await Assert.ThrowsAsync<NotSupportedException>(() => MigrateAsync(scratch, GalleryMigration));
    }

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
