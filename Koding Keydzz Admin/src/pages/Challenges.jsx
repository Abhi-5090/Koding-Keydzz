import { useState } from 'react';
import { Plus, Pencil, Trash2, Zap, Coins, Swords } from 'lucide-react';
import {
  useGetChallengesQuery,
  useCreateChallengeMutation,
  useUpdateChallengeMutation,
  useDeleteChallengeMutation,
} from '../features/admin/adminApi';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';

const DIFFICULTIES = ['easy', 'medium', 'hard'];
const emptyChallenge = {
  title: '',
  description: '',
  difficulty: 'easy',
  xpReward: 50,
  coinReward: 20,
  daily: false,
  active: true,
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.challenges || [];
}

function DiffBadge({ value }) {
  const map = {
    easy: 'bg-success/15 text-success border-success/30',
    medium: 'bg-turmeric/15 text-turmeric border-turmeric/30',
    hard: 'bg-error/15 text-error border-error/30',
  };
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${map[value] || map.easy}`}>
      {value || '—'}
    </span>
  );
}

export default function Challenges() {
  const { data, isError, isLoading, error, refetch } = useGetChallengesQuery();
  const [createChallenge] = useCreateChallengeMutation();
  const [updateChallenge] = useUpdateChallengeMutation();
  const [deleteChallenge] = useDeleteChallengeMutation();

  const challenges = asList(data);

  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  const setField = (e) =>
    setModal((m) => ({
      ...m,
      data: {
        ...m.data,
        [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      },
    }));

  const save = async () => {
    setFormError('');
    const form = {
      ...modal.data,
      xpReward: Number(modal.data.xpReward),
      coinReward: Number(modal.data.coinReward),
    };
    try {
      if (modal.mode === 'create') {
        await createChallenge(form).unwrap();
      } else {
        await updateChallenge({ id: form.id, ...form }).unwrap();
      }
      setModal(null);
    } catch (err) {
      setFormError(err?.data?.message || 'Could not save the challenge. Please try again.');
    }
  };

  const remove = async (item) => {
    try {
      await deleteChallenge(item.id).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirm(null);
  };

  const toggleActive = async (item) => {
    try {
      await updateChallenge({ id: item.id, active: !item.active }).unwrap();
    } catch {
      /* table reflects server state */
    }
  };

  const columns = [
    {
      key: 'title',
      header: 'Challenge',
      render: (r) => (
        <div>
          <p className="font-medium text-text-primary">{r.title}</p>
          <p className="max-w-xs truncate text-xs text-text-secondary/60">{r.description}</p>
        </div>
      ),
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      render: (r) => <DiffBadge value={r.difficulty} />,
      sortValue: (r) => DIFFICULTIES.indexOf(r.difficulty),
    },
    {
      key: 'xpReward',
      header: 'Rewards',
      render: (r) => (
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-turmeric">
            <Zap size={12} /> {r.xpReward}
          </span>
          <span className="inline-flex items-center gap-1 text-accent">
            <Coins size={12} /> {r.coinReward}
          </span>
        </div>
      ),
    },
    {
      key: 'daily',
      header: 'Daily',
      render: (r) =>
        r.daily ? (
          <span className="rounded-full border border-turmeric/30 bg-turmeric/15 px-2 py-0.5 text-xs font-semibold text-turmeric">
            Daily
          </span>
        ) : (
          <span className="text-xs text-text-secondary/50">—</span>
        ),
    },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (
        <button
          onClick={() => toggleActive(r)}
          className={`relative h-5 w-9 rounded-full transition-colors duration-150 ease-out active:scale-95 ${r.active ? 'bg-success' : 'bg-surface'}`}
          title={r.active ? 'Active' : 'Inactive'}
        >
          <span
            className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-200 ease-out ${r.active ? 'translate-x-4' : 'translate-x-0'}`}
          />
        </button>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      sortable: false,
      searchable: false,
      render: (r) => (
        <div className="flex gap-1">
          <button onClick={() => { setFormError(''); setModal({ mode: 'edit', data: { ...r } }); }} className="rounded-lg p-1.5 text-text-secondary hover:text-turmeric">
            <Pencil size={16} />
          </button>
          <button onClick={() => setConfirm(r)} className="rounded-lg p-1.5 text-text-secondary hover:text-error">
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Challenges" subtitle={isLoading ? 'Loading…' : `${challenges.length} challenges`}>
        <Button icon={Plus} onClick={() => { setFormError(''); setModal({ mode: 'create', data: { ...emptyChallenge } }); }}>
          New Challenge
        </Button>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={challenges.length === 0}
        loadingLabel="Loading challenges…"
        emptyTitle="No challenges yet"
        emptyMessage="Create a challenge to reward students with XP and coins."
        emptyIcon={Swords}
      >
        <DataTable columns={columns} data={challenges} searchKeys={['title', 'description', 'difficulty']} pageSize={8} />
      </QueryState>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'New Challenge' : 'Edit Challenge'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save Challenge</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <FormField label="Title" name="title" value={modal.data.title} onChange={setField} required />
            <FormField label="Description" name="description" as="textarea" value={modal.data.description} onChange={setField} />
            <div className="grid grid-cols-3 gap-3">
              <FormField label="Difficulty" name="difficulty" as="select" options={DIFFICULTIES} value={modal.data.difficulty} onChange={setField} />
              <FormField label="XP Reward" name="xpReward" type="number" value={modal.data.xpReward} onChange={setField} />
              <FormField label="Coin Reward" name="coinReward" type="number" value={modal.data.coinReward} onChange={setField} />
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" name="daily" checked={!!modal.data.daily} onChange={setField} className="h-4 w-4 accent-turmeric" />
                Daily challenge
              </label>
              <label className="flex items-center gap-2 text-sm text-text-secondary">
                <input type="checkbox" name="active" checked={!!modal.data.active} onChange={setField} className="h-4 w-4 accent-turmeric" />
                Active
              </label>
            </div>
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
        title="Delete challenge?"
        confirmLabel="Delete"
        message={`"${confirm?.title}" will be permanently removed.`}
      />
    </div>
  );
}
