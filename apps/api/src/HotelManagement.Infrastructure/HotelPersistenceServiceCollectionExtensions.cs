using HotelManagement.Application.Persistence;
using HotelManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Infrastructure;

public static class HotelPersistenceServiceCollectionExtensions
{
    public static IServiceCollection AddHotelPersistence(this IServiceCollection services, string connectionString)
    {
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new ArgumentException("A PostgreSQL connection string is required.", nameof(connectionString));
        }

        services.AddDbContext<HotelDbContext>(options => options.UseNpgsql(connectionString));
        services.AddScoped<IHotelStore, PostgresHotelStore>();
        services.AddScoped<IHotelRatingsStore, PostgresHotelRatingStore>();
        return services;
    }
}
