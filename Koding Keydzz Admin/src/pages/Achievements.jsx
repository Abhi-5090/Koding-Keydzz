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
import QueryState from '../components/ui/QueryState';

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

const emptyAchievement = {
  key: '',
  title: '',
  description: '',
  icon: 'medal',
  criteria: '',
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.achievements || [];
}

export default function Achievements() {
  const { data, isError, isLoading, error, refetch } = useGetAchievementsQuery();
  const [createAchievement] = useCreateAchievementMutation();
  const [updateAchievement] = useUpdateAchievementMutation();
  const [deleteAchievement] = useDeleteAchievementMutation();

  const achievements = asList(data);

  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  const setField = (e) =>
    setModal((m) => ({ ...m, data: { ...m.data, [e.target.name]: e.target.value } }));

  const save = async () => {
    setFormError('');
    const form = modal.data;
    try {
      if (modal.mode === 'create') {
        await createAchievement(form).unwrap();
      } else {
        await updateAchievement({ id: form.id, ...form }).unwrap();
      }
      setModal(null);
    } catch (err) {
      setFormError(err?.data?.message || 'Could not save the badge. Please try again.');
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
      <PageHeader title="Achievements" subtitle={isLoading ? 'Loading…' : `${achievements.length} badges`}>
        <Button icon={Plus} onClick={() => { setFormError(''); setModal({ mode: 'create', data: { ...emptyAchievement } }); }}>
          New Badge
        </Button>
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
              <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                <button onClick={() => { setFormError(''); setModal({ mode: 'edit', data: { ...a } }); }} aria-label={`Edit ${a.title}`} className="rounded-lg bg-malt/80 p-1.5 text-text-secondary hover:text-turmeric">
                  <AnimatedIcon icon={Pencil} size={14} animation="hover" />
                </button>
                <button onClick={() => setConfirm(a)} aria-label={`Delete ${a.title}`} className="rounded-lg bg-malt/80 p-1.5 text-text-secondary hover:text-error">
                  <AnimatedIcon icon={Trash2} size={14} animation="hover" />
                </button>
              </div>

              <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-turmeric/15 text-turmeric shadow-glow">
                <AnimatedIcon icon={iconFor(a.icon)} size={28} animation="pulse" glow className="text-turmeric" />
              </div>
              <h3 className="truncate font-heading font-bold text-text-primary">{a.title}</h3>
              <p className="mt-1 text-sm text-text-secondary/70">{a.description}</p>
              <div className="mt-3 space-y-1.5">
                <code className="block truncate rounded-lg border border-k-border bg-malt/50 px-2 py-1 text-xs text-turmeric">
                  {a.key}
                </code>
                <p className="text-xs text-text-secondary/50">
                  <span className="text-text-secondary/70">Criteria:</span> {a.criteria}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </QueryState>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'New Achievement' : 'Edit Achievement'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save Badge</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div>
              <label className="k-label">Icon</label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map(({ key, icon }) => {
                  const selected = modal.data.icon === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      aria-label={`Use ${key} icon`}
                      aria-pressed={selected}
                      onClick={() => setModal((m) => ({ ...m, data: { ...m.data, icon: key } }))}
                      className={`flex h-10 w-10 items-center justify-center rounded-xl border transition ${
                        selected
                          ? 'border-turmeric bg-turmeric/15 text-turmeric shadow-glow'
                          : 'border-k-border text-text-secondary hover:border-turmeric/50 hover:text-turmeric'
                      }`}
                    >
                      <AnimatedIcon icon={icon} size={20} animation={selected ? 'pulse' : 'hover'} />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Key" name="key" value={modal.data.key} onChange={setField} required placeholder="loop_master" hint="Unique snake_case id" />
              <FormField label="Title" name="title" value={modal.data.title} onChange={setField} required placeholder="Loop Master" />
            </div>
            <FormField label="Description" name="description" as="textarea" value={modal.data.description} onChange={setField} placeholder="What earns this badge?" />
            <FormField label="Criteria" name="criteria" value={modal.data.criteria} onChange={setField} placeholder="xp >= 2000" hint="Rule that unlocks the badge" />
            {formError && (
              <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">{formError}</p>
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
