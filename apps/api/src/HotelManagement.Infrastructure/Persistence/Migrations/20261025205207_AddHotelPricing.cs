using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace HotelManagement.Infrastructure.Persistence.Migrations
{
    public partial class AddHotelPricing : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<short>(
                name: "discount_percent",
                table: "hotels",
                type: "smallint",
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "price_per_night",
                table: "hotels",
                type: "numeric(10,2)",
                precision: 10,
                scale: 2,
                nullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "ck_hotels_discount_percent",
                table: "hotels",
                sql: "discount_percent IS NULL OR discount_percent BETWEEN 1 AND 90");

            migrationBuilder.AddCheckConstraint(
                name: "ck_hotels_discount_requires_price",
                table: "hotels",
                sql: "discount_percent IS NULL OR price_per_night IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "ck_hotels_price_per_night",
                table: "hotels",
                sql: "price_per_night IS NULL OR (price_per_night > 0 AND price_per_night <= 100000)");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            throw new NotSupportedException(
                "AddHotelPricing is forward-only: dropping the pricing columns would discard every stored price.");
        }
    }
}
