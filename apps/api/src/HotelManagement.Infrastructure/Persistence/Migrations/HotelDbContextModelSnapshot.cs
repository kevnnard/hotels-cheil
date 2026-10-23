using System;
using HotelManagement.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace HotelManagement.Infrastructure.Persistence.Migrations
{
    [DbContext(typeof(HotelDbContext))]
    partial class HotelDbContextModelSnapshot : ModelSnapshot
    {
        protected override void BuildModel(ModelBuilder modelBuilder)
        {
#pragma warning disable 612, 618
            modelBuilder
                .HasAnnotation("ProductVersion", "10.0.13")
                .HasAnnotation("Relational:MaxIdentifierLength", 63);

            NpgsqlModelBuilderExtensions.UseIdentityByDefaultColumns(modelBuilder);

            modelBuilder.Entity("HotelManagement.Infrastructure.Persistence.HotelRatingRecord", b =>
                {
                    b.Property<Guid>("HotelId")
                        .HasColumnType("uuid")
                        .HasColumnName("hotel_id");

                    b.Property<Guid>("UserId")
                        .HasColumnType("uuid")
                        .HasColumnName("user_id");

                    b.Property<decimal>("Score")
                        .HasColumnType("numeric")
                        .HasColumnName("score");

                    b.HasKey("HotelId", "UserId")
                        .HasName("pk_hotel_ratings");

                    b.ToTable("hotel_ratings", null, t =>
                        {
                            t.HasCheckConstraint("ck_hotel_ratings_score_range", "score >= 1 AND score <= 5");
                        });
                });

            modelBuilder.Entity("HotelManagement.Infrastructure.Persistence.HotelRecord", b =>
                {
                    b.Property<Guid>("Id")
                        .HasColumnType("uuid")
                        .HasColumnName("id");

                    b.Property<string>("City")
                        .HasMaxLength(100)
                        .HasColumnType("character varying(100)")
                        .HasColumnName("city");

                    b.Property<string>("Country")
                        .HasMaxLength(100)
                        .HasColumnType("character varying(100)")
                        .HasColumnName("country");

                    b.Property<DateTime>("CreatedAtUtc")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("created_at_utc");

                    b.Property<string>("Description")
                        .HasMaxLength(2000)
                        .HasColumnType("character varying(2000)")
                        .HasColumnName("description");

                    b.Property<string>("Email")
                        .HasMaxLength(254)
                        .HasColumnType("character varying(254)")
                        .HasColumnName("email");

                    b.Property<bool>("IsActive")
                        .HasColumnType("boolean")
                        .HasColumnName("is_active");

                    b.Property<string>("Name")
                        .IsRequired()
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)")
                        .HasColumnName("name");

                    b.Property<string>("Phone")
                        .HasMaxLength(30)
                        .HasColumnType("character varying(30)")
                        .HasColumnName("phone");

                    b.Property<string>("PostalCode")
                        .HasMaxLength(20)
                        .HasColumnType("character varying(20)")
                        .HasColumnName("postal_code");

                    b.Property<string>("Region")
                        .HasMaxLength(100)
                        .HasColumnType("character varying(100)")
                        .HasColumnName("region");

                    b.Property<string>("Street")
                        .HasMaxLength(200)
                        .HasColumnType("character varying(200)")
                        .HasColumnName("street");

                    b.Property<DateTime>("UpdatedAtUtc")
                        .HasColumnType("timestamp with time zone")
                        .HasColumnName("updated_at_utc");

                    b.Property<string>("Website")
                        .HasMaxLength(2048)
                        .HasColumnType("character varying(2048)")
                        .HasColumnName("website");

                    b.HasKey("Id")
                        .HasName("pk_hotels");

                    b.ToTable("hotels", (string)null);
                });

            modelBuilder.Entity("HotelManagement.Infrastructure.Persistence.HotelRatingRecord", b =>
                {
                    b.HasOne("HotelManagement.Infrastructure.Persistence.HotelRecord", null)
                        .WithMany()
                        .HasForeignKey("HotelId")
                        .OnDelete(DeleteBehavior.Cascade)
                        .IsRequired()
                        .HasConstraintName("fk_hotel_ratings_hotels");
                });
#pragma warning restore 612, 618
        }
    }
}
