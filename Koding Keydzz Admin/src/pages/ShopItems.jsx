import { useState } from 'react';
import { Plus, Pencil, Trash2, Coins, ShoppingBag, Circle, Star, Gem, Crown } from 'lucide-react';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import {
  useGetShopItemsQuery,
  useCreateShopItemMutation,
  useUpdateShopItemMutation,
  useDeleteShopItemMutation,
} from '../features/admin/adminApi';
import DataTable from '../components/ui/DataTable';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import FormField from '../components/ui/FormField';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import PageHeader from '../components/ui/PageHeader';
import QueryState from '../components/ui/QueryState';

const TYPES = ['skin', 'outfit', 'accessory', 'pet', 'effect'];
const RARITIES = ['common', 'rare', 'epic', 'legendary'];

const emptyItem = {
  key: '',
  name: '',
  type: 'skin',
  price: 100,
  requiredLevel: 1,
  rarity: 'common',
  asset: '',
};

// Rarity markers ramp from cool neutral → teal → warm orange, anchored to the
// two-colour brand. common #9DB8C4 · rare #2DD4BF · epic #FF6A3D · legendary #FF602F.
const RARITY_STYLES = {
  common: 'bg-[#9DB8C4]/10 text-[#9DB8C4] border-[#9DB8C4]/30',
  rare: 'bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30',
  epic: 'bg-accent/15 text-accent border-accent/30',
  legendary: 'bg-turmeric/15 text-turmeric border-turmeric/40',
};

const RARITY_ICONS = {
  common: Circle,
  rare: Star,
  epic: Gem,
  legendary: Crown,
};

function asList(data) {
  if (Array.isArray(data)) return data;
  return data?.items || [];
}

function RarityBadge({ value }) {
  const Icon = RARITY_ICONS[value] || RARITY_ICONS.common;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${RARITY_STYLES[value] || RARITY_STYLES.common}`}>
      <AnimatedIcon icon={Icon} size={12} animation={value === 'legendary' ? 'pulse' : 'pop'} />
      {value}
    </span>
  );
}

export default function ShopItems() {
  const { data, isError, isLoading, error, refetch } = useGetShopItemsQuery();
  const [createItem] = useCreateShopItemMutation();
  const [updateItem] = useUpdateShopItemMutation();
  const [deleteItem] = useDeleteShopItemMutation();

  const items = asList(data);

  const [modal, setModal] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [formError, setFormError] = useState('');

  const setField = (e) =>
    setModal((m) => ({
      ...m,
      data: { ...m.data, [e.target.name]: e.target.value },
    }));

  const save = async () => {
    setFormError('');
    const form = {
      ...modal.data,
      price: Number(modal.data.price),
      requiredLevel: Number(modal.data.requiredLevel),
    };
    try {
      if (modal.mode === 'create') {
        await createItem(form).unwrap();
      } else {
        await updateItem({ id: form.id, ...form }).unwrap();
      }
      setModal(null);
    } catch (err) {
      setFormError(err?.data?.message || 'Could not save the item. Please try again.');
    }
  };

  const remove = async (item) => {
    try {
      await deleteItem(item.id).unwrap();
    } catch {
      /* table reflects server state */
    }
    setConfirm(null);
  };

  const columns = [
    {
      key: 'name',
      header: 'Item',
      render: (r) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-turmeric/15 text-turmeric">
            <ShoppingBag size={16} />
          </div>
          <div>
            <p className="font-medium text-text-primary">{r.name}</p>
            <p className="text-xs text-text-secondary/60">{r.key}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => <span className="capitalize text-text-secondary">{r.type}</span>,
    },
    {
      key: 'rarity',
      header: 'Rarity',
      render: (r) => <RarityBadge value={r.rarity} />,
      sortValue: (r) => RARITIES.indexOf(r.rarity),
    },
    {
      key: 'price',
      header: 'Price',
      render: (r) => (
        <span className="inline-flex items-center gap-1 text-accent">
          <Coins size={13} /> {r.price}
        </span>
      ),
    },
    {
      key: 'requiredLevel',
      header: 'Req. Level',
      render: (r) => <span className="text-text-secondary">Lv {r.requiredLevel}</span>,
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
      <PageHeader title="Shop & Avatars" subtitle={isLoading ? 'Loading…' : `${items.length} catalog items`}>
        <Button icon={Plus} onClick={() => { setFormError(''); setModal({ mode: 'create', data: { ...emptyItem } }); }}>
          New Item
        </Button>
      </PageHeader>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        refetch={refetch}
        isEmpty={items.length === 0}
        loadingLabel="Loading catalog…"
        emptyTitle="No items yet"
        emptyMessage="Add skins, outfits, pets and effects to the avatar shop."
        emptyIcon={ShoppingBag}
      >
        <DataTable columns={columns} data={items} searchKeys={['name', 'key', 'type', 'rarity']} pageSize={8} />
      </QueryState>

      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={modal?.mode === 'create' ? 'New Avatar Item' : 'Edit Avatar Item'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModal(null)}>Cancel</Button>
            <Button onClick={save}>Save Item</Button>
          </>
        }
      >
        {modal && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Key" name="key" value={modal.data.key} onChange={setField} required placeholder="pet_dragon" />
              <FormField label="Name" name="name" value={modal.data.name} onChange={setField} required placeholder="Loop Dragon" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Type" name="type" as="select" options={TYPES} value={modal.data.type} onChange={setField} />
              <FormField label="Rarity" name="rarity" as="select" options={RARITIES} value={modal.data.rarity} onChange={setField} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Price (coins)" name="price" type="number" value={modal.data.price} onChange={setField} />
              <FormField label="Required Level" name="requiredLevel" type="number" value={modal.data.requiredLevel} onChange={setField} />
            </div>
            <FormField label="Asset URL / path" name="asset" value={modal.data.asset} onChange={setField} placeholder="/assets/pets/dragon.png" />
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
        title="Delete item?"
        confirmLabel="Delete"
        message={`"${confirm?.name}" will be removed from the shop catalog.`}
      />
    </div>
  );
}
