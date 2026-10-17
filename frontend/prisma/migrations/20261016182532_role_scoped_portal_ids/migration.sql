-- CreateTable
CREATE TABLE "institute_portal_ids" (
    "id" UUID NOT NULL,
    "institute_id" UUID NOT NULL,
    "role" "Role" NOT NULL,
    "code" VARCHAR(6) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "institute_portal_ids_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "institute_portal_ids_code_key" ON "institute_portal_ids"("code");

-- CreateIndex
CREATE UNIQUE INDEX "institute_portal_ids_institute_id_role_key" ON "institute_portal_ids"("institute_id", "role");

-- AddForeignKey
ALTER TABLE "institute_portal_ids" ADD CONSTRAINT "institute_portal_ids_institute_id_fkey" FOREIGN KEY ("institute_id") REFERENCES "institutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Keep portal IDs six digits and role-prefixed at the database boundary.
ALTER TABLE "institute_portal_ids"
ADD CONSTRAINT "institute_portal_ids_role_prefix_check"
CHECK (
    "code" ~ '^[2-6][0-9]{5}$'
    AND (
        ("role" = 'STUDENT' AND "code" LIKE '2%')
        OR ("role" = 'TRAINER' AND "code" LIKE '3%')
        OR ("role" = 'COUNSELOR' AND "code" LIKE '4%')
        OR ("role" = 'OWNER' AND "code" LIKE '5%')
        OR ("role" = 'ACCOUNTS' AND "code" LIKE '6%')
    )
);
