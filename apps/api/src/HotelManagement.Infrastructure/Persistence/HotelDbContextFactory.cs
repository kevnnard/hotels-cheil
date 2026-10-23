using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace HotelManagement.Infrastructure.Persistence;

public sealed class HotelDbContextFactory : IDesignTimeDbContextFactory<HotelDbContext>
{
    public const string ConnectionStringVariable = "ConnectionStrings__Hotels";

    public HotelDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(ConnectionStringVariable);
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException($"Set {ConnectionStringVariable} before running EF Core tools.");
        }

        return new HotelDbContext(new DbContextOptionsBuilder<HotelDbContext>().UseNpgsql(connectionString).Options);
    }
}
