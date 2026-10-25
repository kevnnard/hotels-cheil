using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelManagement.Infrastructure.Persistence.Migrations
{
    public partial class AddHotelImage : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "image_content_type",
                table: "hotels",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_height",
                table: "hotels",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_size_bytes",
                table: "hotels",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "image_storage_key",
                table: "hotels",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "image_width",
                table: "hotels",
                type: "integer",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ux_hotels_image_storage_key",
                table: "hotels",
                column: "image_storage_key",
                unique: true,
                filter: "image_storage_key IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_hotels_image_metadata",
                table: "hotels",
                sql: "(image_storage_key IS NULL AND image_content_type IS NULL AND image_width IS NULL AND image_height IS NULL AND image_size_bytes IS NULL) OR (image_storage_key IS NOT NULL AND image_content_type IS NOT NULL AND image_width > 0 AND image_height > 0 AND image_size_bytes BETWEEN 1 AND 400000)");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ux_hotels_image_storage_key",
                table: "hotels");

            migrationBuilder.DropCheckConstraint(
                name: "ck_hotels_image_metadata",
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
    }
}
