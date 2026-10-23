using HotelManagement.Application.Identity;

namespace HotelManagement.Api.Tests.Architecture;

public class LayeringTests
{
    [Fact]
    public void TheApiAssembly_DoesNotDependOnThePersistenceStack()
    {
        var referenced = typeof(Program).Assembly
            .GetReferencedAssemblies()
            .Select(name => name.Name!)
            .ToArray();

        Assert.DoesNotContain("Microsoft.EntityFrameworkCore", referenced);
        Assert.DoesNotContain("Microsoft.AspNetCore.Identity.EntityFrameworkCore", referenced);
        Assert.DoesNotContain("Npgsql", referenced);
    }

    [Fact]
    public void TheApiAssembly_DoesNotDependOnTheAccountPersistenceTypes()
    {
        var forbidden = new[] { "ApplicationUser", "AuthSession", "UserManager", "RoleManager" };
        var types = typeof(Program).Assembly.GetTypes();
        var memberTypes = types
            .SelectMany(type => type.GetConstructors())
            .SelectMany(constructor => constructor.GetParameters())
            .Select(parameter => parameter.ParameterType)
            .Concat(types.SelectMany(type => type.GetProperties()).Select(property => property.PropertyType))
            .Concat(types.SelectMany(type => type.GetFields()).Select(field => field.FieldType));
        var referenced = memberTypes
            .SelectMany(type => type.IsGenericType ? type.GetGenericArguments() : [type])
            .Select(type => type.Name)
            .ToArray();

        Assert.Empty(referenced.Intersect(forbidden));
    }

    [Fact]
    public void TheApplicationAssembly_DoesNotDependOnThePersistenceStack()
    {
        var referenced = typeof(AuthenticationService).Assembly
            .GetReferencedAssemblies()
            .Select(name => name.Name!)
            .ToArray();

        Assert.DoesNotContain("Microsoft.EntityFrameworkCore", referenced);
        Assert.DoesNotContain("Microsoft.AspNetCore.Identity.EntityFrameworkCore", referenced);
        Assert.DoesNotContain("Npgsql", referenced);
    }
}
