import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  Award,
  Medal,
  Trophy,
  Flame,
  Star,
  Target,
  Footprints,
  Repeat,
  Rocket,
  Lightbulb,
  Brain,
  Zap,
  Crown,
} from 'lucide-react';
import {
  useGetAchievementsQuery,
  useCreateAchievementMutation,
  useUpdateAchievementMutation,
  useDeleteAchievementMutation,
} from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import { useCan } from '../features/auth/useCan';
import QueryState from '../components/ui/QueryState';
import { formatApiError } from '../utils/apiError';

// Badge icons are stored as a stable string key (e.g. "medal") rather than an
// emoji, then mapped to a lucide component for rendering. Legacy emoji values
// fall back gracefully to the default Medal icon.
const ICON_OPTIONS = [
  { key: 'medal', icon: Medal },
  { key: 'trophy', icon: Trophy },
  { key: 'flame', icon: Flame },
  { key: 'star', icon: Star },
  { key: 'target', icon: Target },
  { key: 'footprints', icon: Footprints },
  { key: 'repeat', icon: Repeat },
  { key: 'rocket', icon: Rocket },
  { key: 'lightbulb', icon: Lightbulb },
  { key: 'brain', icon: Brain },
  { key: 'zap', icon: Zap },
  { key: 'crown', icon: Crown },
];

const ICON_MAP = Object.fromEntries(ICON_OPTIONS.map((o) => [o.key, o.icon]));

function iconFor(key) {
  return ICON_MAP[key] || Medal;
}

/**
 * The criteria types the SERVER can actually evaluate.
 *
 * Copied from backend `src/utils/achievementProgress.js` (`currentValueFor`),
 * which is the only thing that decides whether a badge unlocks. This list
 * matters because the field used to be a free-text box with the placeholder
 * "xp >= 2000" — and that string is not a criteria the evaluator understands.
 * Anything typed there produced a badge whose progress was permanently 0, so
 * it could NEVER be earned, with nothing anywhere to say why.
 *
 * A picker can only produce a rule that works.
 */
export const CRITERIA_TYPES = [
  { value: 'levelsCompleted', label: 'Game levels completed', unit: 'levels' },
  {
    value: 'perfectLevels',
    label: 'Levels finished with 3 stars',
    unit: 'levels',
  },
  { value: 'quizzesPassed', label: 'Quizzes passed', unit: 'quizzes' },
  { value: 'lessonsCompleted', label: 'Lessons completed', unit: 'lessons' },
  { value: 'totalXp', label: 'Total XP earned', unit: 'XP' },
  { value: 'reachLevel', label: 'Reach a level', unit: 'level' },
  { value: 'coinsEarned', label: 'Coins earned in total', unit: 'coins' },
  { value: 'worldsUnlocked', label: 'Worlds unlocked', unit: 'worlds' },
  {
    value: 'dailyChallenge',
    label: 'Daily challenges completed',
    unit: 'challenges',
  },
];

const CRITERIA_LABELS = Object.fromEntries(
  CRITERIA_TYPES.map((c) => [c.value, c]),
);

/** Render `{ type, target }` as a sentence. Never the raw object. */
export function describeCriteria(criteria) {
  if (!criteria) return 'No rule set — this badge can never be earned';
  // Historic rows may carry a free-text string from the old editor.
  if (typeof criteria === 'string') {
    return criteria.trim() ? `${criteria} (not a valid rule)` : 'No rule set';
  }
  const meta = CRITERIA_LABELS[criteria.type];
  const target = Number(criteria.target) || 0;
  if (!meta) {
    return `Unknown rule "${criteria.type || '—'}" — this badge can never be earned`;
  }
  if (criteria.type === 'reachLevel') return `Reach level ${target}`;
  return `${meta.label}: ${target.toLocaleString()} ${meta.unit}`;
}

const emptyAchievement = {
  key: '',
  title: '',
  description: '',
  icon: 'medal',
  // Structured, matching the model. The server stores criteria as
  // `{ type, target }` and evaluates only those two fields.
  criteriaType: 'levelsCompleted',
  criteriaTarget: 10,
};

/**
 * Flatten the stored `criteria` object into the two form fields.
 *
 * Spreading the row straight into the form kept `criteria` as an object, which
 * the free-text input then rendered as a React child — error #31, and the page
 * crashed rather than opening the editor.
 */
function hydrate(a) {
  const c = a?.criteria;
  const type = c && typeof c === 'object' ? c.type : '';
  const target = c && typeof c === 'object' ? c.target : '';
  return {
    ...a,
    criteriaType: CRITERIA_LABELS[type] ? type : 'levelsCompleted',
    criteriaTarget: Number(target) > 0 ? Number(target) : 10,
  };
}

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.achievements || [];
}

export default function Achievements() {
  const { data, isError, isLoading, error, refetch } =
    useGetAchievementsQuery();
  const [createAchievement] = useCreateAchievementMutation();
  const [updateAchievement] = useUpdateAchievementMutation();
  const [deleteAchievement] = useDeleteAchievementMutation();

  const achievements = asList(data);

  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  /**
   * Curriculum is GLOBAL — shared by every school — so only the platform owner
   * may write it. Teachers and school administrators hold `content:read` and
   * reach this page legitimately; every write control shown to them returned
   * 403. Hidden rather than disabled, because they can never do it.
   */
  const canWrite = useCan('content:write');

  const [formError, setFormError] = useState('');

  const setField = (e) =>
    setModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.value },
    }));

  const save = async () => {
    setFormError('');
    // Rebuild the shape the model stores. The two form fields exist only for
    // editing; the API takes `criteria: { type, target }`.
    const { criteriaType, criteriaTarget, ...rest } = modal.data;
    const target = Number(criteriaTarget);
    if (
      !CRITERIA_LABELS[criteriaType] ||
      !Number.isFinite(target) ||
      target < 1
    ) {
      setFormError(
        'Choose a rule and a target of at least 1, or the badge can never be earned.',
      );
      return;
    }
    const form = { ...rest, criteria: { type: criteriaType, target } };
    try {
      if (modal.mode === 'create') {
        await createAchievement(form).unwrap();
      } else {
        await updateAchievement({ id: form.id, ...form }).unwrap();
      }
      setModal(null);
    } catch (err) {
      setFormError(
        formatApiError(err, 'Could not save the badge. Please try again.'),
      );
    }
  };

  const remove = async (item) => {
    try {
      await deleteAchievement(item.id).unwrap();
    } catch {
      /* list reflects server state */
    }
    setConfirm(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Achievements"
        subtitle={isLoading ? 'Loading…' : `${achievements.length} badges`}
      >
        {canWrite ? (
          <Button
            icon={Plus}
            onClick={() => {
              setFormError('');
              setModal({ mode: 'create', data: { ...emptyAchievement } });
            }}
          >
            New Badge
          </Button>
        ) : null}
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={achievements.length === 0}
        loadingLabel="Loading achievements…"
        emptyTitle="No badges yet"
        emptyMessage="Create achievement badges to celebrate student milestones."
        emptyIcon={Award}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {achievements.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="k-card group relative p-5"
            >
              {canWrite ? (
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    onClick={() => {
                      setFormError('');
                      setModal({ mode: 'edit', data: hydrate(a) });
                    }}
                    aria-label={`Edit ${a.title}`}
                    className="rounded-lg bg-malt/80 p-1.5 text-text-secondary hover:text-turmeric"
                  >
                    <AnimatedIcon icon={Pencil} size={14} animation="hover" />
                  </button>
                  <button
                    onClick={() => setConfirm(a)}
                    aria-label={`Delete ${a.title}`}
                    className="rounded-lg bg-malt/80 p-1.5 text-text-secondary hover:text-error"
                  >
                    <AnimatedIcon icon={Trash2} size={14} animation="hover" />
                  </button>
                </div>
              ) : null}

              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-turmeric/15 text-turmeric shadow-glow">
                <AnimatedIcon
                  icon={iconFor(a.icon)}
                  size={28}
                  animation="pulse"
                  glow
                  className="text-turmeric"
                />
              </div>
              <h3 className="truncate font-heading font-bold text-text-primary">
                {a.title}
              </h3>
              <p className="mt-1 text-sm text-text-secondary/70">
                {a.description}
              </p>
              <div className="mt-3 space-y-1.5">
                <code className="block truncate rounded-lg border border-k-border bg-malt/50 px-2 py-1 text-xs text-turmeric">
                  {a.key}
                </code>
                <p className="text-xs text-text-secondary/70">
                  {/* describeCriteria, not the value: this arrives as an
                      object, and rendering one as a React child is what
                      crashed this page. */}
                  <span className="text-text-secondary/70">Unlocks at:</span>{' '}
                  {describeCriteria(a.criteria)}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </QueryState>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={
          modal?.mode === 'create' ? 'New Achievement' : 'Edit Achievement'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Badge</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            {/* A group of buttons, not a single input — so this is a group
                label, not a <label> (which must point at one form control). */}
            <div role="group" aria-labelledby="icon-picker-label">
              <p className="k-label" id="icon-picker-label">
                Icon
              </p>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(({ key, icon }) => {
                  const selected = modal.data.icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Use ${key} icon`}
                      aria-pressed={selected}
                      onClick={() =>
                        setModal((m) => ({
                          ...m,
                          data: { ...m.data, icon: key },
                        }))
                      }
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        selected
                          ? 'border-turmeric bg-turmeric/15 text-turmeric shadow-glow'
                          : 'border-k-border text-text-secondary hover:border-turmeric/50 hover:text-turmeric'
                      }`}
                    >
                      <AnimatedIcon
                        icon={icon}
                        size={20}
                        animation={selected ? 'pulse' : 'hover'}
                      />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField
                label="Key"
                name="key"
                value={modal.data.key}
                onChange={setField}
                required
                placeholder="loop_master"
                hint="Unique snake_case id"
              />
              <FormField
                label="Title"
                name="title"
                value={modal.data.title}
                onChange={setField}
                required
                placeholder="Loop Master"
              />
            </div>
            <FormField
              label="Description"
              name="description"
              as="textarea"
              value={modal.data.description}
              onChange={setField}
              placeholder="What earns this badge?"
            />
            {/* A picker and a number, not free text. The server evaluates
                only `{ type, target }`; anything else yields a badge whose
                progress is permanently 0. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                label="Unlocks when"
                name="criteriaType"
                as="select"
                value={modal.data.criteriaType}
                onChange={setField}
                options={CRITERIA_TYPES.map((c) => ({
                  value: c.value,
                  label: c.label,
                }))}
                required
              />
              <FormField
                label="Target"
                name="criteriaTarget"
                type="number"
                value={modal.data.criteriaTarget}
                onChange={setField}
                required
                hint={
                  CRITERIA_LABELS[modal.data.criteriaType]
                    ? `How many ${CRITERIA_LABELS[modal.data.criteriaType].unit}`
                    : ''
                }
              />
            </div>
            <p className="rounded-lg border border-k-border bg-surface/50 px-3 py-2 text-xs text-text-secondary">
              Preview:{' '}
              {describeCriteria({
                type: modal.data.criteriaType,
                target: Number(modal.data.criteriaTarget) || 0,
              })}
            </p>
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                {formError}
              </p>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => remove(confirm)}
        title="Delete achievement?"
        confirmLabel="Delete"
        message={`Badge "${confirm?.title}" will be permanently removed.`}
      />
    </div>
  );
}
