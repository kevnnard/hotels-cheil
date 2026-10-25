using HotelManagement.Domain.Hotels;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelImageRecordConfiguration : IEntityTypeConfiguration<HotelImageRecord>
{
    public void Configure(EntityTypeBuilder<HotelImageRecord> builder)
    {
        builder.ToTable("hotel_images", table =>
        {
            table.HasCheckConstraint(
                "ck_hotel_images_position",
                $"position BETWEEN {HotelImageSlot.Primary} AND {HotelImageSlot.Count - 1}");
            table.HasCheckConstraint(
                "ck_hotel_images_metadata",
                $"width > 0 AND height > 0 AND size_bytes BETWEEN 1 AND {HotelImage.MaximumBytes}");
        });
        builder.HasKey(image => new { image.HotelId, image.Position }).HasName("pk_hotel_images");
        builder.Property(image => image.Position).ValueGeneratedNever();
        builder.Property(image => image.StorageKey).HasMaxLength(HotelImage.MaximumStorageKeyLength).IsRequired();
        builder.Property(image => image.ContentType).HasMaxLength(50).IsRequired();
        builder.HasIndex(image => image.StorageKey)
            .IsUnique()
            .HasDatabaseName("ux_hotel_images_storage_key");
        builder.HasOne<HotelRecord>()
            .WithMany(hotel => hotel.Images)
            .HasForeignKey(image => image.HotelId)
            .HasConstraintName("fk_hotel_images_hotels")
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired();
    }
}
