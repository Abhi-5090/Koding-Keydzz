import { Course } from '../models/Course.js';
import { User } from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { cognitiveGameProgress, cognitiveRealmComplete } from './courseService.js';

/**
 * STAFF OPENING A REALM BY HAND.
 *
 * WHY THIS EXISTS AT ALL
 * ----------------------
 * Every other lock on the platform is DERIVED — finish the previous thing and
 * the next opens — because a stored flag drifts from the completions it is
 * meant to summarise, and then a child is either stuck in front of finished
 * work or holding a key to work they never did.
 *
 * This is the deliberate exception, and it is a teaching requirement rather
 * than a technical one. A class is taught to a timetable: a teacher who is
 * starting Python with the whole group on Monday cannot wait for the slowest
 * child to finish four games, and a teacher who knows a pupil is ready should
 * not have to make them play a game they will find trivial.
 *
 * WHY IT ONLY EVER ADDS
 * ---------------------
 * A grant widens access; it never narrows it. The derived rule still opens a
 * realm the pupil has earned, so revoking a grant cannot close a realm they
 * actually finished. That asymmetry is what makes the feature safe to hand to
 * a whole staff room: the worst a mistaken click can do is let somebody start
 * early, and the worst a mistaken revoke can do is nothing at all.
 *
 * WHY IT IS SCOPED
 * ----------------
 * A teacher may only grant to pupils they teach. The caller passes the ids
 * their capabilities allow, and this refuses anything outside that set — with
 * 404 rather than 403, so the endpoint cannot be used to discover which pupils
 * exist in other classes.
 */

/** Look up a realm by slug, or fail with something a reader can act on. */
async function realmBySlug(slug) {
  const course = await Course.findOne({ slug }).lean();
  if (!course) throw ApiError.notFound('That realm does not exist.');
  return course;
}

/**
 * A pupil the caller is allowed to act on.
 *
 * `scopeIds === null` means "every pupil in the school" — an administrator.
 * An array means a teacher's own classes, and anything outside it is treated
 * as not existing.
 */
async function pupilInScope(pupilId, { org, scopeIds }) {
  const pupil = await User.findOne({
    _id: pupilId,
    org,
    role: 'student',
    deletedAt: null,
  });
  if (!pupil) throw ApiError.notFound('Student not found');
  if (scopeIds && !scopeIds.some((id) => String(id) === String(pupil._id))) {
    // 404, not 403: a teacher should not learn from this endpoint that a pupil
    // exists in a class they do not teach.
    throw ApiError.notFound('Student not found');
  }
  return pupil;
}

/**
 * Open a realm for one pupil.
 *
 * `$addToSet` rather than a read-modify-`save()`: two teachers granting at the
 * same moment would otherwise each write the array they read, and one grant
 * would vanish. It also makes granting twice a no-op, so a double-click is
 * harmless.
 */
export async function grantRealm({ pupilId, slug, org, scopeIds, grantedBy }) {
  const realm = await realmBySlug(slug);
  const pupil = await pupilInScope(pupilId, { org, scopeIds });

  await User.updateOne({ _id: pupil._id }, { $addToSet: { grantedCourses: realm._id } });

  return {
    student: { id: String(pupil._id), name: pupil.name },
    realm: { id: String(realm._id), slug: realm.slug, title: realm.title },
    granted: true,
    grantedBy: grantedBy ? String(grantedBy) : null,
  };
}

/**
 * Withdraw a hand-granted realm.
 *
 * This removes the GRANT, not the pupil's progress. If they have since earned
 * the realm through the ladder it stays open, which is the point of the
 * add-only design — and the response says so, so the staff screen can explain
 * why a revoke appeared to do nothing.
 */
export async function revokeRealm({ pupilId, slug, org, scopeIds }) {
  const realm = await realmBySlug(slug);
  const pupil = await pupilInScope(pupilId, { org, scopeIds });

  await User.updateOne({ _id: pupil._id }, { $pull: { grantedCourses: realm._id } });

  /**
   * Whether the pupil still reaches it on merit. For the realm after Cognitive
   * Games that means having finished the games; for later realms it means
   * having passed the previous final test, which a revoke cannot undo either.
   */
  const fresh = await User.findById(pupil._id).select('gameProgress');
  const stillEarned = realm.order === 2 ? cognitiveRealmComplete(fresh) : false;

  return {
    student: { id: String(pupil._id), name: pupil.name },
    realm: { id: String(realm._id), slug: realm.slug, title: realm.title },
    granted: false,
    stillOpenOnMerit: stillEarned,
  };
}

/**
 * Who is ready, who is close, and who has a grant — the staff screen's data.
 *
 * The game figures come from `cognitiveGameProgress`, the same function the
 * unlock rule uses. A separate count here would eventually disagree with the
 * gate, and the number on the teacher's screen is the one they would trust.
 */
export async function realmRoster({ org, scopeIds, slug }) {
  const realm = await realmBySlug(slug);

  const filter = { org, role: 'student', deletedAt: null };
  if (scopeIds) filter._id = { $in: scopeIds };

  const pupils = await User.find(filter)
    .select('name username email gameProgress grantedCourses')
    .sort({ name: 1 })
    .lean();

  const items = pupils.map((pupil) => {
    const games = cognitiveGameProgress(pupil);
    const gamesDone = games.filter((g) => g.levelsDone > 0).length;
    const earned = gamesDone >= games.length;
    const granted = (pupil.grantedCourses || []).some(
      (id) => String(id) === String(realm._id)
    );
    return {
      id: String(pupil._id),
      name: pupil.name,
      username: pupil.username || null,
      email: pupil.email || null,
      games,
      gamesDone,
      gamesTotal: games.length,
      // Earned it themselves, was given it, or neither.
      earned,
      granted,
      open: earned || granted,
    };
  });

  return {
    realm: { id: String(realm._id), slug: realm.slug, title: realm.title, order: realm.order },
    total: items.length,
    readyCount: items.filter((i) => i.earned).length,
    grantedCount: items.filter((i) => i.granted).length,
    items,
  };
}

export default { grantRealm, revokeRealm, realmRoster };
