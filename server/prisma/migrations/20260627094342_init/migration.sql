-- CreateEnum
CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'CANTEEN', 'ADMIN');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "clerk_user_id" TEXT,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "department_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_shifts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_shifts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_registrations" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "meal_shift_id" TEXT NOT NULL,
    "meal_date" DATE NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meal_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meal_receipts" (
    "id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by" TEXT,
    "method" TEXT NOT NULL DEFAULT 'QR',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meal_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_clerk_user_id_key" ON "employees"("clerk_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE UNIQUE INDEX "employees_email_key" ON "employees"("email");

-- CreateIndex
CREATE INDEX "employees_department_id_idx" ON "employees"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "meal_shifts_name_key" ON "meal_shifts"("name");

-- CreateIndex
CREATE INDEX "meal_registrations_meal_date_idx" ON "meal_registrations"("meal_date");

-- CreateIndex
CREATE INDEX "meal_registrations_status_idx" ON "meal_registrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "meal_registrations_employee_id_meal_shift_id_meal_date_key" ON "meal_registrations"("employee_id", "meal_shift_id", "meal_date");

-- CreateIndex
CREATE UNIQUE INDEX "meal_receipts_registration_id_key" ON "meal_receipts"("registration_id");

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_registrations" ADD CONSTRAINT "meal_registrations_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_registrations" ADD CONSTRAINT "meal_registrations_meal_shift_id_fkey" FOREIGN KEY ("meal_shift_id") REFERENCES "meal_shifts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meal_receipts" ADD CONSTRAINT "meal_receipts_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "meal_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
