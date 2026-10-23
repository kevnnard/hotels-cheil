using System.Text;
using HotelManagement.Api.Authentication;
using HotelManagement.Application.Hotels;
using HotelManagement.Application.Identity;
using HotelManagement.Domain.Identity;
using HotelManagement.Infrastructure;
using HotelManagement.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("Hotels");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("The ConnectionStrings:Hotels setting is required.");
}

var jwtOptions = JwtOptions.Resolve(builder.Configuration, builder.Environment);
var bootstrapOptions = AdministratorBootstrapOptions.Resolve(builder.Configuration);

builder.Services.AddSingleton(Options.Create(jwtOptions));
builder.Services.AddSingleton(Options.Create(bootstrapOptions));

builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks();

builder.Services.AddHotelPersistence(connectionString);
builder.Services.AddHotelIdentity(bootstrapOptions);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<IAuthenticationService, AuthenticationService>();
builder.Services.AddScoped<IHotelService, HotelService>();
builder.Services.AddSingleton<IAccessTokenIssuer, JwtAccessTokenIssuer>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtOptions.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtOptions.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtOptions.SigningKey)),
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromSeconds(30),
            NameClaimType = "email",
            RoleClaimType = "role"
        };
        options.Events = new JwtBearerEvents
        {
            OnTokenValidated = async context =>
            {
                var session = context.Principal?.FindFirst("sid")?.Value;
                var subject = context.Principal?.FindFirst("sub")?.Value;
                if (!Guid.TryParse(session, out var sessionId) || !Guid.TryParse(subject, out var userId))
                {
                    context.Fail("The access token does not identify an open session.");
                    return;
                }

                var authentication = context.HttpContext.RequestServices.GetRequiredService<IAuthenticationService>();
                if (!await authentication.IsSessionActiveAsync(sessionId, userId, context.HttpContext.RequestAborted))
                {
                    context.Fail("The session is no longer active.");
                }
            }
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(HotelPermissions.Read, policy => policy.RequireRole(HotelRoles.Administrator, HotelRoles.User));
    options.AddPolicy(HotelPermissions.Create, policy => policy.RequireRole(HotelRoles.Administrator));
    options.AddPolicy(HotelPermissions.Update, policy => policy.RequireRole(HotelRoles.Administrator));
    options.AddPolicy(HotelPermissions.Delete, policy => policy.RequireRole(HotelRoles.Administrator));
});


var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health");

app.Run();
