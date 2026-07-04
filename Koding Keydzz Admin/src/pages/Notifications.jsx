import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Megaphone, Gift, CalendarDays, Send, CheckCircle2, Bell } from 'lucide-react';
import AnimatedIcon from '../components/ui/AnimatedIcon';
import { useBroadcastNotificationMutation } from '../features/admin/adminApi';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import PageHeader from '../components/ui/PageHeader';

const TYPES = [
  { value: 'announcement', label: 'Announcement', icon: Megaphone, desc: 'General message to all students' },
  { value: 'reward', label: 'Reward', icon: Gift, desc: 'Grant XP / coins to everyone' },
  { value: 'event', label: 'Event', icon: CalendarDays, desc: 'Promote an upcoming event' },
];

const AUDIENCES = [
  { value: 'all', label: 'All Students' },
  { value: 'active', label: 'Active Students' },
  { value: 'idle', label: 'Idle Students' },
];

export default function Notifications() {
  const [broadcast, { isLoading }] = useBroadcastNotificationMutation();

  const [type, setType] = useState('announcement');
  const [form, setForm] = useState({
    title: '',
    message: '',
    audience: 'all',
    xpReward: 50,
    coinReward: 25,
    eventDate: '',
  });
  const [sent, setSent] = useState(null);
  const [sendError, setSendError] = useState('');
  const [log, setLog] = useState([]);

  const setField = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSendError('');
    const payload = {
      type,
      title: form.title,
      message: form.message,
      audience: form.audience,
      ...(type === 'reward' && {
        xpReward: Number(form.xpReward),
        coinReward: Number(form.coinReward),
      }),
      ...(type === 'event' && { eventDate: form.eventDate }),
    };
    try {
      await broadcast(payload).unwrap();
    } catch (err) {
      const network =
        err?.status === 'FETCH_ERROR' || err?.status === 'TIMEOUT_ERROR';
      setSendError(
        network
          ? 'Could not reach the server. Please try again.'
          : err?.data?.message || 'Could not send the broadcast. Please try again.'
      );
      return;
    }
    const entry = {
      id: Date.now(),
      ...payload,
      at: new Date().toLocaleString(),
    };
    setLog((l) => [entry, ...l].slice(0, 8));
    setSent(`Sent to ${AUDIENCES.find((a) => a.value === form.audience)?.label}.`);
    setForm((f) => ({ ...f, title: '', message: '', eventDate: '' }));
    setTimeout(() => setSent(null), 4000);
  };

  const activeType = TYPES.find((t) => t.value === type);

  return (
    <div className="space-y-6">
      <PageHeader title="Notifications" subtitle="Broadcast messages, rewards & events" />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="k-card p-6">
            {/* type selector */}
            <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={`flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition ${
                    type === t.value
                      ? 'border-turmeric bg-turmeric/10 shadow-glow'
                      : 'border-k-border hover:border-turmeric/50'
                  }`}
                >
                  <t.icon size={20} className={type === t.value ? 'text-turmeric' : 'text-text-secondary'} />
                  <span className="font-heading text-sm font-bold text-text-primary">{t.label}</span>
                  <span className="text-xs text-text-secondary/60">{t.desc}</span>
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-4">
              <FormField label="Title" name="title" value={form.title} onChange={setField} required placeholder={`${activeType.label} title`} />
              <FormField label="Message" name="message" as="textarea" rows={4} value={form.message} onChange={setField} required placeholder="Write your message to students..." />
              <FormField label="Audience" name="audience" as="select" options={AUDIENCES} value={form.audience} onChange={setField} />

              <AnimatePresence>
                {type === 'reward' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid grid-cols-2 gap-4 overflow-hidden"
                  >
                    <FormField label="XP Reward" name="xpReward" type="number" value={form.xpReward} onChange={setField} />
                    <FormField label="Coin Reward" name="coinReward" type="number" value={form.coinReward} onChange={setField} />
                  </motion.div>
                )}
                {type === 'event' && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                    <FormField label="Event Date" name="eventDate" type="date" value={form.eventDate} onChange={setField} />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center gap-4 pt-2">
                <Button type="submit" icon={Send} loading={isLoading}>
                  Broadcast {activeType.label}
                </Button>
                <AnimatePresence>
                  {sent && (
                    <motion.span
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="inline-flex items-center gap-1.5 text-sm text-success"
                    >
                      <AnimatedIcon icon={CheckCircle2} size={16} animation="pop" className="text-success" /> {sent}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>

              {sendError && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error">
                  {sendError}
                </p>
              )}
            </form>
          </div>
        </div>

        {/* recent log + preview */}
        <div className="space-y-5">
          <div className="k-card p-5">
            <h3 className="mb-3 font-heading text-sm font-bold text-text-primary">Live Preview</h3>
            <div className="rounded-xl border border-k-border bg-malt/50 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-turmeric/20 p-2 text-turmeric">
                  <activeType.icon size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text-primary">
                    {form.title || `${activeType.label} title`}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-xs text-text-secondary/70">
                    {form.message || 'Your message preview appears here.'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="k-card p-5">
            <h3 className="mb-3 flex items-center gap-2 font-heading text-sm font-bold text-text-primary">
              <AnimatedIcon icon={Bell} size={15} animation="wiggle" className="text-turmeric" /> Recent Broadcasts
            </h3>
            {log.length === 0 ? (
              <p className="py-4 text-center text-sm text-text-secondary/50">Nothing sent yet.</p>
            ) : (
              <div className="space-y-3">
                {log.map((n) => (
                  <div key={n.id} className="rounded-lg border border-k-border/60 bg-malt/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-text-primary">{n.title}</span>
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] uppercase tracking-wide text-text-secondary/70">
                        {n.type}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-text-secondary/60">{n.at}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
