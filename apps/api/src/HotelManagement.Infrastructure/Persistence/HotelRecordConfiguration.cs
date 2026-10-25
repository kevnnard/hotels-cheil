using HotelManagement.Domain.Hotels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelRecordConfiguration : IEntityTypeConfiguration<HotelRecord>
{
    public void Configure(EntityTypeBuilder<HotelRecord> builder)
    {
        builder.HasKey(hotel => hotel.Id).HasName("pk_hotels");
        builder.Property(hotel => hotel.Id).ValueGeneratedNever();
        builder.Property(hotel => hotel.Name).HasMaxLength(200).IsRequired();
        builder.Property(hotel => hotel.Description).HasMaxLength(2000);
        builder.Property(hotel => hotel.Street).HasMaxLength(200);
        builder.Property(hotel => hotel.City).HasMaxLength(100);
        builder.Property(hotel => hotel.Region).HasMaxLength(100);
        builder.Property(hotel => hotel.Country).HasMaxLength(100);
        builder.Property(hotel => hotel.PostalCode).HasMaxLength(20);
        builder.Property(hotel => hotel.Phone).HasMaxLength(30);
        builder.Property(hotel => hotel.Email).HasMaxLength(254);
        builder.Property(hotel => hotel.Website).HasMaxLength(2048);
        builder.Property(hotel => hotel.ImageStorageKey).HasMaxLength(HotelImage.MaximumStorageKeyLength);
        builder.Property(hotel => hotel.ImageContentType).HasMaxLength(50);
        builder.Property(hotel => hotel.IsActive).IsRequired();
        builder.Property(hotel => hotel.CreatedAtUtc).IsRequired();
        builder.Property(hotel => hotel.UpdatedAtUtc).IsRequired();
        builder.HasIndex(hotel => hotel.ImageStorageKey)
            .IsUnique()
            .HasDatabaseName("ux_hotels_image_storage_key")
            .HasFilter("image_storage_key IS NOT NULL");
        builder.ToTable("hotels", table => table.HasCheckConstraint(
            "ck_hotels_image_metadata",
            "(image_storage_key IS NULL AND image_content_type IS NULL AND image_width IS NULL AND image_height IS NULL AND image_size_bytes IS NULL)"
            + $" OR (image_storage_key IS NOT NULL AND image_content_type IS NOT NULL AND image_width > 0 AND image_height > 0 AND image_size_bytes BETWEEN 1 AND {HotelImage.MaximumBytes})"));
    }
}
