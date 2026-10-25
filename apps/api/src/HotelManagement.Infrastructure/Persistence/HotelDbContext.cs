using System.Text.RegularExpressions;
using HotelManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class HotelDbContext(DbContextOptions<HotelDbContext> options)
    : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>(options)
{
    internal DbSet<HotelRecord> Hotels => Set<HotelRecord>();
    internal DbSet<HotelImageRecord> HotelImages => Set<HotelImageRecord>();
    internal DbSet<HotelRatingRecord> HotelRatings => Set<HotelRatingRecord>();
    internal DbSet<AuthSession> AuthSessions => Set<AuthSession>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HotelDbContext).Assembly);

        foreach (var property in modelBuilder.Model.GetEntityTypes().SelectMany(entity => entity.GetProperties()))
        {
            property.SetColumnName(Regex.Replace(property.Name, "(?<=[a-z0-9])(?=[A-Z])", "_").ToLowerInvariant());
        }
    }
}
