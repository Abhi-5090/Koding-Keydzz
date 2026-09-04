import { useSelector } from 'react-redux';
import { selectCapabilities } from './authSlice';

/**
 * Does the signed-in user hold this capability?
 *
 * WHY THIS EXISTS
 * ---------------
 * The curriculum pages — courses, worlds, quizzes, achievements, shop items —
 * are reachable by anyone with `content:read`, which is superadmin, admin AND
 * faculty. Writing curriculum needs `content:write`, which is superadmin only:
 * the content is global and shared by every tenant, so one school must not be
 * able to rename a world or delete a quiz for all the others.
 *
 * That rule was enforced on the server and ignored by the client, so every
 * teacher and every school administrator was shown New / Edit / Delete on all
 * five pages and every click returned 403. Twenty-seven affordances that could
 * not work.
 *
 * The capability list comes from the server on sign-in (`buildAuthUser`), so
 * this hook and the API agree by construction rather than by a duplicated
 * role check that can drift.
 *
 * This hides controls; it is NOT a security boundary. The API re-checks every
 * request, so a hand-typed URL or a devtools poke changes nothing.
 *
 *   const canWrite = useCan('content:write');
 *   {canWrite ? <Button onClick={create}>New course</Button> : null}
 */
export function useCan(capability) {
  const capabilities = useSelector(selectCapabilities);
  return capabilities.includes(capability);
}

export default useCan;
