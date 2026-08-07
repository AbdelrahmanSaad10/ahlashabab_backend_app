-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "case_id" TEXT,
ADD COLUMN     "project_id" TEXT;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
