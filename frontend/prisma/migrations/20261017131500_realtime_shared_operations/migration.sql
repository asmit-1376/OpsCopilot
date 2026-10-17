ALTER TABLE "batches"
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "courses"
ADD COLUMN "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "students"
ADD COLUMN "email" TEXT;

UPDATE "students" AS student
SET "email" = account."email"
FROM "users" AS account
WHERE student."user_id" = account."id"
  AND student."email" IS NULL;

CREATE TABLE "realtime_events" (
    "id" BIGSERIAL NOT NULL,
    "institute_id" UUID NOT NULL,
    "actor_id" UUID,
    "event_type" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "realtime_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "realtime_events_institute_id_id_idx"
ON "realtime_events"("institute_id", "id");

CREATE UNIQUE INDEX "students_institute_id_email_key"
ON "students"("institute_id", "email");

ALTER TABLE "realtime_events"
ADD CONSTRAINT "realtime_events_institute_id_fkey"
FOREIGN KEY ("institute_id") REFERENCES "institutes"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "realtime_events"
ADD CONSTRAINT "realtime_events_actor_id_fkey"
FOREIGN KEY ("actor_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
