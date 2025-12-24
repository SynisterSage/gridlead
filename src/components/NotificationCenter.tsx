import React from 'react';
import { CheckCircle2, Clock, X, Bell } from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  open: boolean;
  notifications: NotificationItem[];
  onClose: () => void;
  onMarkAllRead: () => void;
  onMarkRead: (id: string) => void;
  onDelete: (id: string) => void;
}

const badgeColor = (type: NotificationItem['type']) => {
  switch (type) {
    case 'reply': return 'bg-emerald-500';
    case 'lead': return 'bg-sky-400';
    case 'send_failed': return 'bg-rose-500';
    case 'gmail_disconnected': return 'bg-amber-500';
    case 'goal_hit': return 'bg-indigo-500';
    case 'weekly': return 'bg-violet-400';
    default: return 'bg-slate-500';
  }
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  notifications,
  onClose,
  onMarkAllRead,
  onMarkRead,
  onDelete,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center pointer-events-none">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] pointer-events-auto z-[80]"
        onClick={onClose}
      />
      <div className="pointer-events-auto w-full max-w-md mb-28 px-4 animate-in fade-in slide-in-from-bottom-4 duration-200 relative z-[90]">
        <div className="rounded-3xl bg-slate-900 text-white border border-slate-800 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Bell size={16} className="text-amber-400" />
              <p className="text-sm font-bold uppercase tracking-[0.2em]">Notifications</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onMarkAllRead}
                className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
              >
                Mark all read
              </button>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="max-h-[380px] overflow-y-auto divide-y divide-slate-800">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-slate-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">All caught up</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-5 py-4 bg-transparent ${n.unread ? 'bg-slate-900' : 'bg-slate-900/80'}`}
                >
                  <div className={`w-2 h-2 rounded-full mt-1.5 ${badgeColor(n.type)}`} />
                  <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{n.title}</p>
                    <p className="text-[11px] text-slate-400 leading-snug">{n.body}</p>
                      {n.meta?.icon ? (
                        <div className="mt-2">
                          <img src={n.meta.icon} alt="icon" className="w-10 h-10 rounded-md object-cover" />
                        </div>
                      ) : null}
                    <div className="flex items-center gap-2 mt-2 text-[10px] uppercase tracking-[0.2em] text-slate-500">
                      <Clock size={10} />
                      <span>{new Date(n.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <button
                      onClick={() => onDelete(n.id)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-400"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
