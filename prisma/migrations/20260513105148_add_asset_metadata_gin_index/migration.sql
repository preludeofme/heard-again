-- GIN index on Asset.metadata for efficient JSON path queries used by
-- narration sibling-prune (storyId + voiceProfileId) and cached-asset lookup.
CREATE INDEX IF NOT EXISTS "Asset_metadata_gin" ON "Asset" USING GIN (metadata);
