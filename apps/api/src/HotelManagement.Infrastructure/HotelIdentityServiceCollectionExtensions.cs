using HotelManagement.Application.Identity;
using HotelManagement.Domain.Identity;
using HotelManagement.Infrastructure.Identity;
using HotelManagement.Infrastructure.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace HotelManagement.Infrastructure;

public static class HotelIdentityServiceCollectionExtensions
{
    public static IServiceCollection AddHotelIdentity(this IServiceCollection services, AdministratorBootstrapOptions bootstrapOptions)
    {
        services.AddIdentityCore<ApplicationUser>();
        services.AddScoped<IUserStore<ApplicationUser>, UserStore<ApplicationUser, IdentityRole<Guid>, HotelDbContext, Guid>>();
        services.AddScoped<IRoleStore<IdentityRole<Guid>>, RoleStore<IdentityRole<Guid>, HotelDbContext, Guid>>();
        services.AddScoped<IRoleValidator<IdentityRole<Guid>>, RoleValidator<IdentityRole<Guid>>>();
        services.AddScoped<RoleManager<IdentityRole<Guid>>>();

        services.Configure<IdentityOptions>(options =>
        {
            options.User.RequireUniqueEmail = true;
            options.Password.RequiredLength = AccountRules.PasswordMinimumLength;
            options.Password.RequireDigit = true;
            options.Password.RequireLowercase = false;
            options.Password.RequireUppercase = false;
            options.Password.RequireNonAlphanumeric = false;
        });

        services.AddScoped<IUserAccountStore, PostgresUserAccountStore>();
        services.AddScoped<ISessionStore, PostgresSessionStore>();

        services.AddSingleton(Microsoft.Extensions.Options.Options.Create(bootstrapOptions));
        services.AddHostedService<IdentityBootstrapHostedService>();
        return services;
    }
}
