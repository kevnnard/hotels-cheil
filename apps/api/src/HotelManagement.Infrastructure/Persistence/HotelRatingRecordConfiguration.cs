using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HotelManagement.Infrastructure.Persistence;

internal sealed class HotelRatingRecordConfiguration : IEntityTypeConfiguration<HotelRatingRecord>
{
    public void Configure(EntityTypeBuilder<HotelRatingRecord> builder)
    {
        builder.ToTable(
            "hotel_ratings",
            table => table.HasCheckConstraint("ck_hotel_ratings_score_range", "score >= 1 AND score <= 5"));
        builder.HasKey(rating => new { rating.HotelId, rating.UserId }).HasName("pk_hotel_ratings");
        builder.Property(rating => rating.Score).HasColumnType("numeric").IsRequired();
        builder.HasOne<HotelRecord>()
            .WithMany()
            .HasForeignKey(rating => rating.HotelId)
            .HasConstraintName("fk_hotel_ratings_hotels")
            .OnDelete(DeleteBehavior.Cascade)
            .IsRequired();
    }
}
