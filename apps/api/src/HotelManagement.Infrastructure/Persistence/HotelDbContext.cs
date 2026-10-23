using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class HotelDbContext(DbContextOptions<HotelDbContext> options) : DbContext(options)
{
    internal DbSet<HotelRecord> Hotels => Set<HotelRecord>();
    internal DbSet<HotelRatingRecord> HotelRatings => Set<HotelRatingRecord>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HotelDbContext).Assembly);

        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
        {
            property.SetColumnName(Regex.Replace(property.Name, "(?<=[a-z0-9])(?=[A-Z])", "_").ToLowerInvariant());
        }
    }
}
