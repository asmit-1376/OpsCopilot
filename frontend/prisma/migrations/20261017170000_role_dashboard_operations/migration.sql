CREATE TYPE "LeadStage" AS ENUM ('NEW', 'CONTACTED', 'DEMO_ATTENDED', 'READY_TO_ENROLL', 'ENROLLED', 'LOST');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "NoteType" AS ENUM ('GENERAL', 'PHONE_CALL', 'EMAIL', 'WHATSAPP', 'MEETING');
CREATE TYPE "EscalationStatus" AS ENUM ('OPEN', 'IN_REVIEW', 'RESOLVED', 'CLOSED');
CREATE TYPE "CommunicationChannel" AS ENUM ('WHATSAPP', 'EMAIL');
CREATE TYPE "CommunicationStatus" AS ENUM ('DRAFT', 'QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');
CREATE TYPE "BankTransactionStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'IGNORED');

CREATE TABLE "admission_leads" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "created_by_id" UUID,
  "assigned_counselor_id" UUID,
  "converted_student_id" UUID,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "guardian_name" TEXT,
  "guardian_phone" TEXT,
  "target_track" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "stage" "LeadStage" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "admission_leads_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "counselor_tasks" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "assigned_to_id" UUID,
  "created_by_id" UUID,
  "student_id" UUID,
  "lead_id" UUID,
  "title" TEXT NOT NULL,
  "due_at" TIMESTAMPTZ(3),
  "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM',
  "completed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "counselor_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_notes" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "author_id" UUID,
  "note_type" "NoteType" NOT NULL DEFAULT 'GENERAL',
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "student_notes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "student_escalations" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "student_id" UUID NOT NULL,
  "created_by_id" UUID,
  "assigned_to_id" UUID,
  "reason" TEXT NOT NULL,
  "details" TEXT,
  "status" "EscalationStatus" NOT NULL DEFAULT 'OPEN',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMPTZ(3),
  CONSTRAINT "student_escalations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "communications" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "student_id" UUID,
  "created_by_id" UUID,
  "recipient_name" TEXT NOT NULL,
  "recipient_address" TEXT NOT NULL,
  "channel" "CommunicationChannel" NOT NULL,
  "template" TEXT,
  "message" TEXT NOT NULL,
  "status" "CommunicationStatus" NOT NULL DEFAULT 'DRAFT',
  "provider_ref" TEXT,
  "queued_at" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "communications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bank_transactions" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "imported_by_id" UUID,
  "payment_id" UUID,
  "reference" TEXT NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "sender_name" TEXT,
  "source" "PaymentSource" NOT NULL,
  "status" "BankTransactionStatus" NOT NULL DEFAULT 'UNMATCHED',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_reminders" (
  "id" UUID NOT NULL,
  "institute_id" UUID NOT NULL,
  "installment_id" UUID NOT NULL,
  "created_by_id" UUID,
  "channel" "CommunicationChannel" NOT NULL,
  "status" "CommunicationStatus" NOT NULL DEFAULT 'QUEUED',
  "provider_ref" TEXT,
  "queued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sent_at" TIMESTAMPTZ(3),
  CONSTRAINT "payment_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "admission_leads_institute_id_email_key" ON "admission_leads"("institute_id", "email");
CREATE INDEX "admission_leads_institute_id_stage_created_at_idx" ON "admission_leads"("institute_id", "stage", "created_at");
CREATE INDEX "admission_leads_assigned_counselor_id_stage_idx" ON "admission_leads"("assigned_counselor_id", "stage");
CREATE INDEX "counselor_tasks_institute_id_completed_at_due_at_idx" ON "counselor_tasks"("institute_id", "completed_at", "due_at");
CREATE INDEX "counselor_tasks_assigned_to_id_completed_at_due_at_idx" ON "counselor_tasks"("assigned_to_id", "completed_at", "due_at");
CREATE INDEX "student_notes_institute_id_student_id_created_at_idx" ON "student_notes"("institute_id", "student_id", "created_at");
CREATE INDEX "student_escalations_institute_id_status_created_at_idx" ON "student_escalations"("institute_id", "status", "created_at");
CREATE INDEX "communications_institute_id_status_created_at_idx" ON "communications"("institute_id", "status", "created_at");
CREATE UNIQUE INDEX "bank_transactions_payment_id_key" ON "bank_transactions"("payment_id");
CREATE UNIQUE INDEX "bank_transactions_institute_id_reference_key" ON "bank_transactions"("institute_id", "reference");
CREATE INDEX "bank_transactions_institute_id_status_occurred_at_idx" ON "bank_transactions"("institute_id", "status", "occurred_at");
CREATE INDEX "payment_reminders_institute_id_status_queued_at_idx" ON "payment_reminders"("institute_id", "status", "queued_at");
CREATE INDEX "payment_reminders_installment_id_queued_at_idx" ON "payment_reminders"("installment_id", "queued_at");

ALTER TABLE "admission_leads" ADD CONSTRAINT "admission_leads_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "admission_leads" ADD CONSTRAINT "admission_leads_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_leads" ADD CONSTRAINT "admission_leads_assigned_counselor_id_fkey" FOREIGN KEY ("assigned_counselor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "admission_leads" ADD CONSTRAINT "admission_leads_converted_student_id_fkey" FOREIGN KEY ("converted_student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counselor_tasks" ADD CONSTRAINT "counselor_tasks_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "counselor_tasks" ADD CONSTRAINT "counselor_tasks_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counselor_tasks" ADD CONSTRAINT "counselor_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "counselor_tasks" ADD CONSTRAINT "counselor_tasks_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "counselor_tasks" ADD CONSTRAINT "counselor_tasks_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "admission_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_notes" ADD CONSTRAINT "student_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_escalations" ADD CONSTRAINT "student_escalations_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_escalations" ADD CONSTRAINT "student_escalations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "student_escalations" ADD CONSTRAINT "student_escalations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "student_escalations" ADD CONSTRAINT "student_escalations_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "communications" ADD CONSTRAINT "communications_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_imported_by_id_fkey" FOREIGN KEY ("imported_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "installments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "payment_reminders" ADD CONSTRAINT "payment_reminders_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
