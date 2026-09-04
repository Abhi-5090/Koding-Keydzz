# Backing up and restoring Koding Keydzz

## Why this document exists

The repository had no backup or restore procedure at all. That is a gap with
teeth here, because of *what* this platform stores:

- **Final-test results and certificates are permanent records.** A certificate
  says a named child passed a named course on a named date, and the whole point
  of the verification code is that somebody can rely on it years later. There is
  no way to recreate that from anything else.
- **Question banks hold mark schemes.** Losing them does not just lose content;
  it makes every historical result unauditable.
- **Multi-tenant.** One bad restore does not affect one user, it affects every
  school on the platform at once.

**An untested restore is the same as no backup.** The procedure below therefore
ends with a rehearsal, and the rehearsal is not optional.

---

## What must be backed up

| What | Where it lives | Notes |
|---|---|---|
| All application data | MongoDB | The only stateful store. Everything below is derived from it. |
| Uploaded files | `uploads/` (or the object store, if configured) | Certificate template artwork, avatar assets, roster spreadsheets. |
| Secrets | `.env`, held **outside** the repository | Not in git by design. Back these up separately, in a password manager or a secrets service — never alongside the database dump, or one stolen archive is both the data and the keys to it. |

`node_modules`, `dist/` and logs are all reproducible and are not backed up.

---

## Taking a backup

```bash
# Point at the database you actually mean. Read it from the environment rather
# than typing it, so a copied command cannot dump the wrong cluster.
export MONGO_URI="mongodb+srv://…"

ops/backup.sh                 # writes ops/backups/kk-YYYY-MM-DD-HHMM.archive.gz
ops/backup.sh /mnt/backups    # or somewhere else
```

The script uses `mongodump --archive --gzip`, which produces one file rather
than a directory tree — easier to checksum, copy and verify, and it cannot be
half-copied without the checksum failing.

### Schedule

| Frequency | Retention | Why |
|---|---|---|
| Hourly | 24 hours | Recovery from an operator mistake, which is the likeliest cause of data loss. |
| Nightly | 30 days | Recovery from a fault discovered days later, e.g. a bad migration. |
| Monthly | 12 months | An academic year. A school will ask about last year's results. |

Store at least one copy **off the machine that runs the database**. A backup on
the same host survives a bad `deleteMany` and nothing else.

---

## Restoring

> Restoring **overwrites**. Read the whole section before running anything.

```bash
# 1. Stop the API so nothing writes while the data underneath it changes.
docker compose stop api

# 2. Restore into a SCRATCH database first and look at it.
ops/restore.sh ops/backups/kk-2026-09-05-0300.archive.gz \
  "mongodb://127.0.0.1:27017/kk_restore_check"

# 3. Sanity-check the scratch copy. Counts should be in the right order of
#    magnitude and the newest certificate should be about as recent as expected.
mongosh "mongodb://127.0.0.1:27017/kk_restore_check" --quiet --eval '
  ["users","certificates","testattempts","questions","organizations"]
    .forEach(c => print(c.padEnd(16), db[c].countDocuments()));
  const latest = db.certificates.find().sort({completedAt:-1}).limit(1).toArray()[0];
  print("newest certificate:", latest ? latest.completedAt : "none");
'

# 4. Only then restore over the real database.
ops/restore.sh ops/backups/kk-2026-09-05-0300.archive.gz "$MONGO_URI"

# 5. Bring migrations up to date. Safe to run unconditionally: applied
#    migrations are recorded and skipped.
cd "Koding Keydzz Backend" && npm run migrate

# 6. Start the API and check it is actually ready, not merely alive.
docker compose start api
curl -fsS localhost:5000/api/v1/ready
```

Step 6 matters: `/health` says the process is up, `/ready` says it can do its
job. A 503 there names the missing dependency.

---

## Rehearsing it (do this, then diarise it)

A restore nobody has performed is a hypothesis. Once a quarter:

1. Take a fresh backup.
2. Restore it into a scratch database, as in step 2 above.
3. Point a **local** API at the scratch database and sign in as a seeded user.
4. Open a pupil's certificate and verify its code at `/verify/<code>`. This
   exercises the data that matters most and is the hardest to reconstruct.
5. Write down how long the whole thing took. That number is your real recovery
   time, and it is the only honest input to any promise made to a school.

---

## What is deliberately not here

**Down-migrations.** The migration runner has no `down()` and will not get one.
Reversing a field drop cannot restore the data that was in it, so a
down-migration offers a rollback that does not exist. The real rollback path is
this document.
