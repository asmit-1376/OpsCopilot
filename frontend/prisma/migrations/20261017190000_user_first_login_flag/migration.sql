ALTER TABLE "users"
ADD COLUMN "has_logged_in" BOOLEAN NOT NULL DEFAULT FALSE;

-- Preserve the completed-login state for existing credential accounts.
UPDATE "users" AS "u"
SET "has_logged_in" = TRUE
WHERE EXISTS (
  SELECT 1
  FROM "auth_accounts" AS "a"
  WHERE "a"."user_id" = "u"."id"
    AND "a"."provider_id" = 'credential'
    AND "a"."password" IS NOT NULL
);
