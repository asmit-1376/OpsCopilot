ALTER TYPE "PolicyDecision" ADD VALUE 'REQUIRE_APPROVAL';

CREATE TYPE "CopilotMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
CREATE TYPE "CopilotMessageStatus" AS ENUM ('STREAMING', 'COMPLETED', 'FAILED', 'CANCELLED');

ALTER TABLE "copilot_threads"
ADD COLUMN "title" TEXT NOT NULL DEFAULT 'New conversation',
ADD COLUMN "active_request_id" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "archived_at" TIMESTAMPTZ(3);

ALTER TABLE "copilot_requests"
ADD COLUMN "client_request_id" UUID;

CREATE UNIQUE INDEX "copilot_requests_client_request_id_key"
ON "copilot_requests"("client_request_id");

CREATE INDEX "copilot_threads_institute_id_user_id_updated_at_idx"
ON "copilot_threads"("institute_id", "user_id", "updated_at");

CREATE TABLE "copilot_messages" (
    "id" UUID NOT NULL,
    "thread_id" UUID NOT NULL,
    "request_id" UUID,
    "role" "CopilotMessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "CopilotMessageStatus" NOT NULL DEFAULT 'COMPLETED',
    "sequence" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "copilot_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "copilot_messages_thread_id_sequence_key"
ON "copilot_messages"("thread_id", "sequence");

CREATE INDEX "copilot_messages_thread_id_created_at_idx"
ON "copilot_messages"("thread_id", "created_at");

ALTER TABLE "copilot_messages"
ADD CONSTRAINT "copilot_messages_thread_id_fkey"
FOREIGN KEY ("thread_id") REFERENCES "copilot_threads"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "copilot_messages"
ADD CONSTRAINT "copilot_messages_request_id_fkey"
FOREIGN KEY ("request_id") REFERENCES "copilot_requests"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
