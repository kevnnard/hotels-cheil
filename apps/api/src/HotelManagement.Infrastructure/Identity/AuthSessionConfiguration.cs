using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelManagement.Infrastructure.Identity;

internal sealed class AuthSessionConfiguration : IEntityTypeConfiguration<AuthSession>
{
    public void Configure(EntityTypeBuilder<AuthSession> builder)
    {
        builder.ToTable("auth_sessions");
        builder.HasKey(session => session.Id).HasName("pk_auth_sessions");
        builder.Property(session => session.Id).ValueGeneratedNever();
        builder.Property(session => session.UserId).IsRequired();
        builder.Property(session => session.CreatedAtUtc).IsRequired();
        builder.Property(session => session.ExpiresAtUtc).IsRequired();
        builder.HasOne<ApplicationUser>()
            .WithMany()
            .HasForeignKey(session => session.UserId)
            .OnDelete(DeleteBehavior.Cascade)
            .HasConstraintName("fk_auth_sessions_users");
        builder.HasIndex(session => session.UserId).HasDatabaseName("ix_auth_sessions_user_id");
    }
}
