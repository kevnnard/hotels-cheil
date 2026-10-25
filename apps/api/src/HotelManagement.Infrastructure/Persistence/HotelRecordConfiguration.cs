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
        builder.Property(hotel => hotel.PricePerNight).HasPrecision(10, 2);
        builder.Property(hotel => hotel.DiscountPercent);
        builder.Property(hotel => hotel.IsActive).IsRequired();
        builder.Property(hotel => hotel.CreatedAtUtc).IsRequired();
        builder.Property(hotel => hotel.UpdatedAtUtc).IsRequired();
        builder.ToTable("hotels", table =>
        {
            table.HasCheckConstraint(
                "ck_hotels_price_per_night",
                $"price_per_night IS NULL OR (price_per_night > 0 AND price_per_night <= {HotelPricing.MaximumNightlyRate})");
            table.HasCheckConstraint(
                "ck_hotels_discount_percent",
                $"discount_percent IS NULL OR discount_percent BETWEEN {HotelPricing.MinimumDiscountPercent} AND {HotelPricing.MaximumDiscountPercent}");
            table.HasCheckConstraint(
                "ck_hotels_discount_requires_price",
                "discount_percent IS NULL OR price_per_night IS NOT NULL");
        });
    }
}
