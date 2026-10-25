using HotelManagement.Application.Images;
using HotelManagement.Infrastructure.Images;
using HotelManagement.Infrastructure.Storage;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Infrastructure;

public static class HotelImageServiceCollectionExtensions
{
    public static IServiceCollection AddHotelImages(this IServiceCollection services, ImageStorageOptions storageOptions)
    {
        services.AddSingleton(storageOptions);
        services.AddSingleton<IFileStorageService, LocalFileStorageService>();
        services.AddSingleton<IImageOptimizationService, MagickImageOptimizationService>();
        services.AddHostedService<ImageStorageStartupCheck>();
        return services;
    }
}
