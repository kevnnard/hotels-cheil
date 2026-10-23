using HotelManagement.TestSupport.Persistence;

namespace HotelManagement.Infrastructure.Tests.Persistence;

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresDatabaseFixture>
{
    public const string Name = "PostgreSQL";
}
