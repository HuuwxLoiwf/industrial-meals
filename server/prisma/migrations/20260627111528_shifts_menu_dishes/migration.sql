-- CreateEnum
CREATE TYPE "ShiftPeriod" AS ENUM ('DAY', 'NIGHT');

-- CreateEnum
CREATE TYPE "MealType" AS ENUM ('STANDARD', 'ALTERNATIVE');

-- CreateEnum
CREATE TYPE "DishCategory" AS ENUM ('MAIN', 'SIDE', 'DESSERT', 'ALTERNATIVE');

-- AlterTable
ALTER TABLE "meal_registrations" ADD COLUMN     "meal_type" "MealType" NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "meal_shifts" ADD COLUMN     "duration_min" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "period" "ShiftPeriod" NOT NULL DEFAULT 'DAY';

-- CreateTable
CREATE TABLE "dishes" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "DishCategory" NOT NULL,
    "image_url" TEXT,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dishes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_menus" (
    "id" TEXT NOT NULL,
    "menu_date" DATE NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_menus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "menu_items" (
    "id" TEXT NOT NULL,
    "menu_id" TEXT NOT NULL,
    "dish_id" TEXT NOT NULL,

    CONSTRAINT "menu_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dishes_category_idx" ON "dishes"("category");

-- CreateIndex
CREATE UNIQUE INDEX "daily_menus_menu_date_key" ON "daily_menus"("menu_date");

-- CreateIndex
CREATE UNIQUE INDEX "menu_items_menu_id_dish_id_key" ON "menu_items"("menu_id", "dish_id");

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_menu_id_fkey" FOREIGN KEY ("menu_id") REFERENCES "daily_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "menu_items" ADD CONSTRAINT "menu_items_dish_id_fkey" FOREIGN KEY ("dish_id") REFERENCES "dishes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
