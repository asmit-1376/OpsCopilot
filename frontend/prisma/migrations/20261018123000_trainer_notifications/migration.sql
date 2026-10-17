CREATE TYPE "NotificationType" AS ENUM (
  'EXTRA_LECTURE_ASSIGNED',
  'SESSION_REASSIGNED',
  'SESSION_RESCHEDULED',
  'SESSION_CANCELLED',
  'TIMETABLE_PUBLISHED'
);

ALTER TABLE "realtime_events"
  ADD COLUMN "recipient_user_id" UUID;

CREATE TABLE "notifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "institute_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "session_id" UUID,
  "plan_id" UUID,
  "payload" JSONB NOT NULL,
  "dedupe_key" TEXT NOT NULL,
  "read_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
CREATE INDEX "notifications_institute_id_created_at_idx" ON "notifications"("institute_id", "created_at");
CREATE INDEX "realtime_events_recipient_user_id_id_idx" ON "realtime_events"("recipient_user_id", "id");

ALTER TABLE "realtime_events"
  ADD CONSTRAINT "realtime_events_recipient_user_id_fkey"
  FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_institute_id_fkey"
  FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notifications"
  ADD CONSTRAINT "notifications_plan_id_fkey"
  FOREIGN KEY ("plan_id") REFERENCES "schedule_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
