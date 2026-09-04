import { describe, it, expect } from 'vitest';
import { parseMongoUri, looksLikeTestDb, hostIsLocal } from './integration/harness.js';

/**
 * THE GUARD THAT STANDS BETWEEN `npm test` AND A REAL DATABASE.
 *
 * The integration harness empties every collection it can reach and drops the
 * database when it finishes. Whether that lands on a scratch database or on
 * production is decided entirely by the three functions tested here, so they
 * are tested as a security boundary rather than as string helpers.
 *
 * Every case below is written from the direction of the accident: what would a
 * stray `MONGO_URI` have to look like for the suite to start deleting?
 */

describe('looksLikeTestDb', () => {
  it('accepts the databases this project actually uses', () => {
    expect(looksLikeTestDb('koding_keydzz_test')).toBe(true);
    expect(looksLikeTestDb('koding_keydzz_ci')).toBe(true);
    expect(looksLikeTestDb('test')).toBe(true);
    expect(looksLikeTestDb('kk-test-1')).toBe(true);
    // The per-run name vitest.config.js builds, so run isolation cannot be
    // undone by the guard rejecting its own database.
    expect(looksLikeTestDb('koding_keydzz_test_11894')).toBe(true);
  });

  it('REJECTS the production database name', () => {
    // The name on the live cluster. The single most important case here.
    expect(looksLikeTestDb('Koding_Keydzz')).toBe(false);
  });

  it('rejects a name that merely CONTAINS the letters', () => {
    /**
     * The hole that motivated the rewrite, in its database-name form. A guard
     * matching a bare substring treats these as test databases:
     *   • "latest"   — ends in "test"
     *   • "precious" — contains "ci"
     * Both are plausible real database names, and either one would have been
     * emptied by a run.
     */
    expect(looksLikeTestDb('latest')).toBe(false);
    expect(looksLikeTestDb('greatest_hits')).toBe(false);
    expect(looksLikeTestDb('precious')).toBe(false);
    expect(looksLikeTestDb('social')).toBe(false);
    expect(looksLikeTestDb('civics')).toBe(false);
  });

  it('rejects an absent name rather than defaulting to permissive', () => {
    expect(looksLikeTestDb('')).toBe(false);
    expect(looksLikeTestDb(undefined)).toBe(false);
    expect(looksLikeTestDb(null)).toBe(false);
  });
});

describe('parseMongoUri', () => {
  it('reads the database name off a plain local URI', () => {
    const { hosts, dbName, isSrv } = parseMongoUri('mongodb://127.0.0.1:27017/koding_keydzz_test');
    expect(hosts).toEqual(['127.0.0.1']);
    expect(dbName).toBe('koding_keydzz_test');
    expect(isSrv).toBe(false);
  });

  it('NEVER lets credentials be read as the database name', () => {
    /**
     * The exact hole in the old guard. `/test|ci/i` was applied to the whole
     * connection string, so a password containing "ci" satisfied it — and the
     * suite then wiped the production database the URI pointed at. Randomly
     * generated passwords contain a given two-letter pair often enough that
     * this is a matter of when, not whether.
     */
    const uri = 'mongodb+srv://admin:Pr3ciou5@cluster0.example.mongodb.net/Koding_Keydzz';
    const { dbName } = parseMongoUri(uri);

    expect(dbName).toBe('Koding_Keydzz');
    expect(looksLikeTestDb(dbName)).toBe(false);
    // ...while the whole-string check that used to guard this passes it:
    expect(/test|ci/i.test(uri)).toBe(true);
  });

  it('survives a password containing an @', () => {
    // Taking the FIRST '@' would read half the password as the host.
    const { hosts, dbName } = parseMongoUri('mongodb://user:p@ss@127.0.0.1:27017/kk_test');
    expect(hosts).toEqual(['127.0.0.1']);
    expect(dbName).toBe('kk_test');
  });

  it('strips query options from the database name', () => {
    const { dbName } = parseMongoUri(
      'mongodb+srv://u:p@c0.example.mongodb.net/kk_test?retryWrites=true&w=majority'
    );
    expect(dbName).toBe('kk_test');
  });

  it('reads every host of a replica set', () => {
    const { hosts } = parseMongoUri(
      'mongodb://a.example.com:27017,b.example.com:27017/kk_test'
    );
    expect(hosts).toEqual(['a.example.com', 'b.example.com']);
  });

  it('flags an srv URI, which is how a managed cluster is always addressed', () => {
    expect(parseMongoUri('mongodb+srv://u:p@c0.example.mongodb.net/kk_test').isSrv).toBe(true);
  });

  it('reports no database when the URI names none', () => {
    // Must not be mistaken for a test database.
    const { dbName } = parseMongoUri('mongodb://127.0.0.1:27017');
    expect(dbName).toBe('');
    expect(looksLikeTestDb(dbName)).toBe(false);
  });
});

describe('hostIsLocal', () => {
  it('allows the hosts a developer and CI actually use', () => {
    // The CI workflow runs Mongo as a service container on loopback.
    expect(hostIsLocal('127.0.0.1')).toBe(true);
    expect(hostIsLocal('localhost')).toBe(true);
    expect(hostIsLocal('::1')).toBe(true);
    // The docker-compose service name.
    expect(hostIsLocal('mongo')).toBe(true);
  });

  it('allows a private LAN address', () => {
    expect(hostIsLocal('192.168.1.20')).toBe(true);
    expect(hostIsLocal('10.0.0.5')).toBe(true);
    expect(hostIsLocal('172.17.0.2')).toBe(true);
  });

  it('REJECTS a managed cluster', () => {
    // A test run has no business opening this connection at all, whatever the
    // database on the far end happens to be called.
    expect(hostIsLocal('cluster0.example.mongodb.net')).toBe(false);
    expect(hostIsLocal('db.example.com')).toBe(false);
  });

  it('does not mistake a public address for a private one', () => {
    // 172.32 is outside the private 172.16–172.31 range, and a prefix-only
    // check on "172." would have let it through.
    expect(hostIsLocal('172.32.0.1')).toBe(false);
    expect(hostIsLocal('11.0.0.1')).toBe(false);
    expect(hostIsLocal('192.169.0.1')).toBe(false);
  });
});
