using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelManagement.Infrastructure.Persistence.Migrations
{
    public partial class AddHotelImageGallery : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "hotel_images",
                columns: table => new
                {
                    hotel_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    storage_key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    content_type = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    width = table.Column<int>(type: "integer", nullable: false),
                    height = table.Column<int>(type: "integer", nullable: false),
                    size_bytes = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hotel_images", x => new { x.hotel_id, x.position });
                    table.CheckConstraint("ck_hotel_images_metadata", "width > 0 AND height > 0 AND size_bytes BETWEEN 1 AND 400000");
                    table.CheckConstraint("ck_hotel_images_position", "position BETWEEN 0 AND 2");
                    table.ForeignKey(
                        name: "fk_hotel_images_hotels",
                        column: x => x.hotel_id,
                        principalTable: "hotels",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ux_hotel_images_storage_key",
                table: "hotel_images",
                column: "storage_key",
                unique: true);

            migrationBuilder.Sql(
                """
                INSERT INTO hotel_images (hotel_id, position, storage_key, content_type, width, height, size_bytes)
                SELECT id, 0, image_storage_key, image_content_type, image_width, image_height, image_size_bytes
                FROM hotels
                WHERE image_storage_key IS NOT NULL
                    AND image_content_type IS NOT NULL
                    AND image_width IS NOT NULL
                    AND image_height IS NOT NULL
                    AND image_size_bytes IS NOT NULL;
                """);

            migrationBuilder.DropCheckConstraint(
                name: "ck_hotels_image_metadata",
                table: "hotels");

            migrationBuilder.DropIndex(
                name: "ux_hotels_image_storage_key",
                table: "hotels");

            migrationBuilder.DropColumn(
                name: "image_content_type",
                table: "hotels");

            migrationBuilder.DropColumn(
                name: "image_height",
                table: "hotels");

            migrationBuilder.DropColumn(
                name: "image_size_bytes",
                table: "hotels");

            migrationBuilder.DropColumn(
                name: "image_storage_key",
                table: "hotels");

            migrationBuilder.DropColumn(
                name: "image_width",
                table: "hotels");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "AddHotelImageGallery is forward-only: a single image column cannot hold positions 1 and 2 without losing them.");
        }
    }
}
