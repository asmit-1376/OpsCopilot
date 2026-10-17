CREATE TYPE "SchedulePlanStatus" AS ENUM ('DRAFT', 'REJECTED', 'CANCELLED', 'PUBLISHED', 'FAILED');

ALTER TABLE "batches"
  ADD COLUMN "sessions_per_week" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "session_duration_minutes" INTEGER NOT NULL DEFAULT 120;

ALTER TABLE "sessions"
  ADD COLUMN "subject_id" UUID,
  ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "subjects" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "course_id" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  CONSTRAINT "subjects_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "batch_subject_plans" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "batch_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "required_minutes" INTEGER NOT NULL,
  "completed_minutes" INTEGER NOT NULL DEFAULT 0,
  "deadline" DATE NOT NULL,
  "minimum_sessions_per_week" INTEGER NOT NULL DEFAULT 1,
  "maximum_sessions_per_week" INTEGER NOT NULL DEFAULT 5,
  CONSTRAINT "batch_subject_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "trainer_subject_eligibility" (
  "trainer_id" UUID NOT NULL,
  "subject_id" UUID NOT NULL,
  "proficiency_level" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "trainer_subject_eligibility_pkey" PRIMARY KEY ("trainer_id", "subject_id")
);

CREATE TABLE "trainer_availability_exceptions" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "trainer_id" UUID NOT NULL,
  "starts_at" TIMESTAMPTZ(3) NOT NULL,
  "ends_at" TIMESTAMPTZ(3) NOT NULL,
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "trainer_availability_exceptions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schedule_plans" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "requested_by_id" UUID NOT NULL,
  "published_by_id" UUID,
  "retry_of_id" UUID,
  "query" TEXT NOT NULL,
  "request_payload" JSONB NOT NULL,
  "input_snapshot" JSONB NOT NULL,
  "input_hash" TEXT NOT NULL,
  "solver_result" JSONB NOT NULL,
  "validation_result" JSONB NOT NULL,
  "status" "SchedulePlanStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "published_at" TIMESTAMPTZ(3),
  CONSTRAINT "schedule_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schedule_plan_changes" (
  "id" UUID NOT NULL,
  "plan_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "change_type" TEXT NOT NULL,
  "before" JSONB NOT NULL,
  "after" JSONB NOT NULL,
  "reason" TEXT NOT NULL,
  CONSTRAINT "schedule_plan_changes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subjects_course_id_name_key" ON "subjects"("course_id", "name");
CREATE INDEX "subjects_institute_id_name_idx" ON "subjects"("institute_id", "name");
CREATE UNIQUE INDEX "batch_subject_plans_batch_id_subject_id_key" ON "batch_subject_plans"("batch_id", "subject_id");
CREATE INDEX "batch_subject_plans_institute_id_deadline_idx" ON "batch_subject_plans"("institute_id", "deadline");
CREATE INDEX "trainer_availability_exceptions_institute_id_starts_at_ends_at_idx" ON "trainer_availability_exceptions"("institute_id", "starts_at", "ends_at");
CREATE INDEX "trainer_availability_exceptions_trainer_id_starts_at_ends_at_idx" ON "trainer_availability_exceptions"("trainer_id", "starts_at", "ends_at");
CREATE INDEX "sessions_subject_id_starts_at_idx" ON "sessions"("subject_id", "starts_at");
CREATE INDEX "schedule_plans_institute_id_status_created_at_idx" ON "schedule_plans"("institute_id", "status", "created_at");
CREATE UNIQUE INDEX "schedule_plan_changes_plan_id_session_id_key" ON "schedule_plan_changes"("plan_id", "session_id");
CREATE INDEX "schedule_plan_changes_session_id_idx" ON "schedule_plan_changes"("session_id");

ALTER TABLE "subjects" ADD CONSTRAINT "subjects_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "subjects" ADD CONSTRAINT "subjects_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "batch_subject_plans" ADD CONSTRAINT "batch_subject_plans_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "batch_subject_plans" ADD CONSTRAINT "batch_subject_plans_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trainer_subject_eligibility" ADD CONSTRAINT "trainer_subject_eligibility_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_subject_eligibility" ADD CONSTRAINT "trainer_subject_eligibility_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_availability_exceptions" ADD CONSTRAINT "trainer_availability_exceptions_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "trainer_availability_exceptions" ADD CONSTRAINT "trainer_availability_exceptions_trainer_id_fkey" FOREIGN KEY ("trainer_id") REFERENCES "trainers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "subjects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_plans" ADD CONSTRAINT "schedule_plans_retry_of_id_fkey" FOREIGN KEY ("retry_of_id") REFERENCES "schedule_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "schedule_plan_changes" ADD CONSTRAINT "schedule_plan_changes_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "schedule_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "schedule_plan_changes" ADD CONSTRAINT "schedule_plan_changes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
