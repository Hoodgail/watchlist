BEGIN;
-- Stop instead of guessing if one legacy TMDB reference already spans movie and TV.
DO $$ BEGIN
  IF EXISTS (
    SELECT ref_id FROM (
      SELECT ref_id, CASE WHEN type = 'MOVIE' THEN 'movie' ELSE 'tv' END AS kind FROM media_sources WHERE ref_id ~ '^tmdb:[0-9]+$'
      UNION ALL
      SELECT ref_id, CASE WHEN type = 'MOVIE' THEN 'movie' ELSE 'tv' END FROM media_items WHERE ref_id ~ '^tmdb:[0-9]+$'
      UNION ALL
      SELECT ref_id, CASE WHEN media_type = 'MOVIE' THEN 'movie' ELSE 'tv' END FROM comments WHERE ref_id ~ '^tmdb:[0-9]+$'
      UNION ALL
      SELECT ref_id, CASE WHEN type = 'MOVIE' THEN 'movie' ELSE 'tv' END FROM collection_items WHERE ref_id ~ '^tmdb:[0-9]+$'
      UNION ALL
      SELECT ref_id, CASE WHEN type = 'MOVIE' THEN 'movie' ELSE 'tv' END FROM suggestions WHERE ref_id ~ '^tmdb:[0-9]+$'
    ) refs GROUP BY ref_id HAVING count(DISTINCT kind) > 1
  ) THEN RAISE EXCEPTION 'Ambiguous legacy TMDB references: inspect movie/TV collisions before migration'; END IF;
END $$;

CREATE TEMP TABLE media_reference_migration ON COMMIT DROP AS
SELECT ref_id AS old_ref, 'tmdb:' || CASE WHEN type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(ref_id from 6) AS new_ref
FROM media_sources WHERE ref_id ~ '^tmdb:[0-9]+$';

UPDATE media_sources SET ref_id = m.new_ref FROM media_reference_migration m WHERE ref_id = m.old_ref;
UPDATE media_items SET ref_id = 'tmdb:' || CASE WHEN type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(ref_id from 6) WHERE ref_id ~ '^tmdb:[0-9]+$';
UPDATE collection_items SET ref_id = 'tmdb:' || CASE WHEN type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(ref_id from 6) WHERE ref_id ~ '^tmdb:[0-9]+$';
UPDATE suggestions SET ref_id = 'tmdb:' || CASE WHEN type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(ref_id from 6) WHERE ref_id ~ '^tmdb:[0-9]+$';
UPDATE comments SET ref_id = 'tmdb:' || CASE WHEN media_type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(ref_id from 6) WHERE ref_id ~ '^tmdb:[0-9]+$';
UPDATE provider_mappings SET ref_id = m.new_ref FROM media_reference_migration m WHERE ref_id = m.old_ref;
UPDATE watch_progress SET media_id = m.new_ref FROM media_reference_migration m WHERE media_id = m.old_ref;
UPDATE media_source_aliases a SET ref_id = 'tmdb:' || CASE WHEN s.type = 'MOVIE' THEN 'movie/' ELSE 'tv/' END || substring(a.ref_id from 6)
FROM media_sources s WHERE a.media_source_id = s.id AND a.ref_id ~ '^tmdb:[0-9]+$';
-- Keep historical aliases, but normalize the retired AniList prefix consistently.
UPDATE media_sources SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE media_items SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE collection_items SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE suggestions SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE comments SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE provider_mappings SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';
UPDATE watch_progress SET media_id = regexp_replace(media_id, '^consumet-anilist:', 'anilist:') WHERE media_id LIKE 'consumet-anilist:%';
UPDATE media_source_aliases SET ref_id = regexp_replace(ref_id, '^consumet-anilist:', 'anilist:') WHERE ref_id LIKE 'consumet-anilist:%';

-- A user's playback selection must never replace another user's selection.
ALTER TABLE provider_mappings ADD COLUMN user_id text;
UPDATE provider_mappings p SET user_id = u.id FROM users u WHERE p.verified_by = u.id;
ALTER TABLE provider_mappings ADD CONSTRAINT provider_mappings_user_id_fkey FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
DROP INDEX provider_mappings_ref_id_provider_key;
CREATE UNIQUE INDEX provider_mappings_user_id_ref_id_provider_key ON provider_mappings(user_id, ref_id, provider);
-- Legacy automatic rows keep user_id NULL and are never used as personal choices.
ALTER TABLE watch_progress ALTER COLUMN episode_id TYPE varchar(500);
COMMIT;
