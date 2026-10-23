using HotelManagement.Domain.Identity;
using HotelManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace HotelManagement.Api.Authentication;

public sealed class IdentityBootstrapHostedService(
    IServiceScopeFactory scopeFactory,
    IOptions<AdministratorBootstrapOptions> options,
    ILogger<IdentityBootstrapHostedService> logger) : IHostedService
{
    private readonly AdministratorBootstrapOptions settings = options.Value;

    public async Task StartAsync(CancellationToken cancellationToken)
    {
        await EnsureRolesAsync(cancellationToken);
        await EnsureAdministratorAsync(cancellationToken);
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    private async Task EnsureRolesAsync(CancellationToken cancellationToken)
    {
        using var scope = scopeFactory.CreateScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        foreach (var role in new[] { HotelRoles.Administrator, HotelRoles.User })
        {
            if (await roles.RoleExistsAsync(role))
            {
                continue;
            }

            var created = await roles.CreateAsync(new IdentityRole<Guid> { Id = Guid.CreateVersion7(), Name = role });
            if (!created.Succeeded)
            {
                throw new InvalidOperationException($"The role {role} could not be created: {Describe(created)}");
            }
        }
    }

    private async Task EnsureAdministratorAsync(CancellationToken cancellationToken)
    {
        if (!settings.IsConfigured)
        {
            logger.LogInformation("No administrator bootstrap is configured.");
            return;
        }

        if (!AccountRules.IsValidEmail(settings.Email))
        {
            throw new InvalidOperationException($"{AdministratorBootstrapOptions.SectionName}:Email is not a valid email address.");
        }

        if (!AccountRules.IsValidPassword(settings.Password))
        {
            throw new InvalidOperationException($"{AdministratorBootstrapOptions.SectionName}:Password does not meet the password requirements.");
        }

        using var scope = scopeFactory.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

        if (await users.FindByEmailAsync(settings.Email) is not null)
        {
            logger.LogInformation("The administrator account already exists.");
            return;
        }

        var administrator = new ApplicationUser
        {
            Id = Guid.CreateVersion7(),
            UserName = settings.Email,
            Email = settings.Email,
            EmailConfirmed = true
        };

        var created = await users.CreateAsync(administrator, settings.Password);
        if (!created.Succeeded)
        {
            throw new InvalidOperationException($"The administrator account could not be created: {Describe(created)}");
        }

        var assigned = await users.AddToRoleAsync(administrator, HotelRoles.Administrator);
        if (!assigned.Succeeded)
        {
            throw new InvalidOperationException($"The administrator role could not be assigned: {Describe(assigned)}");
        }

        logger.LogInformation("The administrator account was created.");
    }

    private static string Describe(IdentityResult result) =>
        string.Join(" ", result.Errors.Select(error => error.Description));
}
