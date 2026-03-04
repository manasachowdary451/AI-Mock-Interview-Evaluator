ALTER TABLE "MockInterview"
ADD COLUMN IF NOT EXISTS ats_score integer;

ALTER TABLE "MockInterview"
ADD COLUMN IF NOT EXISTS ats_result text;

ALTER TABLE "MockInterview"
ADD COLUMN IF NOT EXISTS resume_text text;

ALTER TABLE "MockInterview"
ADD COLUMN IF NOT EXISTS ats_suggestions text;
