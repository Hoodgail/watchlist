import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { describe, expect, it } from 'vitest';

const baseline = await readFile('prisma/migrations/20260919000000_baseline/migration.sql', 'utf8');
const upgrade = await readFile(
  'prisma/migrations/20260919210000_media_identity/migration.sql',
  'utf8',
);
async function withLegacySchema(run: (client: Client) => Promise<void>) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const schema = `migration_fixture_${Date.now()}`;
  try {
    await client.query(`CREATE SCHEMA ${schema}`);
    await client.query(`SET search_path TO ${schema}`);
    await client.query(baseline);
    await run(client);
  } finally {
    await client.query('ROLLBACK');
    await client.query('SET search_path TO public');
    await client.query(`DROP SCHEMA ${schema} CASCADE`);
    await client.end();
  }
}
describe('existing database migration', () => {
  it('preserves records, separates TMDB namespaces, and assigns verified mappings to their author', async () => {
    await withLegacySchema(async (client) => {
      await client.query(
        `INSERT INTO users(id,username,email,updated_at) VALUES ('u1','fixture','fixture@example.com',now())`,
      );
      await client.query(
        `INSERT INTO media_sources(id,ref_id,title,type,updated_at) VALUES ('s1','tmdb:42','Fixture','MOVIE',now())`,
      );
      await client.query(
        `INSERT INTO media_items(id,user_id,ref_id,source_id,type,status,updated_at) VALUES ('i1','u1','tmdb:42','s1','MOVIE','PLAN_TO_WATCH',now())`,
      );
      await client.query(
        `INSERT INTO provider_mappings(id,ref_id,provider,provider_id,provider_title,verified_by,updated_at) VALUES ('p1','tmdb:42','flixhq','fixture','Fixture','u1',now())`,
      );
      await client.query(upgrade);
      expect((await client.query('SELECT ref_id FROM media_items')).rows[0].ref_id).toBe(
        'tmdb:movie/42',
      );
      expect((await client.query('SELECT ref_id,user_id FROM provider_mappings')).rows[0]).toEqual({
        ref_id: 'tmdb:movie/42',
        user_id: 'u1',
      });
      expect(
        (await client.query('SELECT count(*)::int AS count FROM media_sources')).rows[0].count,
      ).toBe(1);
    });
  });
  it('refuses ambiguous legacy movie/TV references and rolls back', async () => {
    await withLegacySchema(async (client) => {
      await client.query(
        `INSERT INTO media_sources(id,ref_id,title,type,updated_at) VALUES ('s1','tmdb:42','Fixture','MOVIE',now())`,
      );
      await client.query(
        `INSERT INTO comments(id,content,ref_id,media_type,updated_at) VALUES ('c1','Fixture','tmdb:42','TV',now())`,
      );
      await expect(client.query(upgrade)).rejects.toThrow('Ambiguous legacy TMDB');
      await client.query('ROLLBACK');
      expect((await client.query('SELECT ref_id FROM media_sources')).rows[0].ref_id).toBe(
        'tmdb:42',
      );
    });
  });
});
