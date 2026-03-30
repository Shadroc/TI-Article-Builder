-- Add step_metadata JSONB column for structured data (needs_image, quality signals, duration)
-- Separate from text output_summary which is human-readable
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS step_metadata jsonb DEFAULT NULL;

COMMENT ON COLUMN workflow_steps.step_metadata IS 'Structured metadata: needs_image flag, quality signals, duration breakdown';
