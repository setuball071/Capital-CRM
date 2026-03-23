-- Add image_urls column to system_updates for screenshot attachments
ALTER TABLE system_updates
  ADD COLUMN IF NOT EXISTS image_urls text[] NOT NULL DEFAULT '{}';
