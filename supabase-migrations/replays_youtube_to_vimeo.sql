-- Migration : YouTube → Vimeo (#42 Phase 4)
-- Renomme youtube_video_id → vimeo_video_id, ajoute vimeo_hash et thumbnail_url.

ALTER TABLE replays RENAME COLUMN youtube_video_id TO vimeo_video_id;
ALTER TABLE replays ADD COLUMN vimeo_hash    TEXT;
ALTER TABLE replays ADD COLUMN thumbnail_url TEXT;
