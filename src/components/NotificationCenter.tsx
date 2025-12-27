import React from 'react';
import {
  Bell,
  X,
  Info,
  AlertTriangle,
  MessageSquare,
  Target,
  AlertOctagon,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { NotificationItem } from '../types';

interface NotificationCenterProps {
  open: boolean;
  inbox: NotificationItem[];
  archive: NotificationItem[];
  activeTab: 'inbox' | 'archive';
  onTabChange: (tab: 'inbox' | 'archive') => void;
  onClose: () => void;
  onMarkAllRead: () => void;
  onArchiveAll: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}

const iconConfig: Record<
  NotificationItem['type'] | 'default',
  { Icon: React.ComponentType<any>; color: string; bg: string }
> = {
  lead: { Icon: Target, color: 'text-emerald-400', bg: 'bg-emerald-500/15' },
  lead_assigned: { Icon: Target, color: 'text-teal-300', bg: 'bg-teal-500/15' },
  reply: { Icon: MessageSquare, color: 'text-amber-300', bg: 'bg-amber-500/15' },
  send_failed: { Icon: AlertOctagon, color: 'text-rose-300', bg: 'bg-rose-500/15' },
  gmail_disconnected: { Icon: AlertTriangle, color: 'text-orange-300', bg: 'bg-orange-500/15' },
  goal_hit: { Icon: TrendingUp, color: 'text-indigo-300', bg: 'bg-indigo-500/15' },
  pipeline_threshold: { Icon: TrendingDown, color: 'text-amber-300', bg: 'bg-amber-500/15' },
  weekly: { Icon: Info, color: 'text-sky-300', bg: 'bg-sky-500/15' },
  info: { Icon: Info, color: 'text-sky-300', bg: 'bg-sky-500/15' },
  default: { Icon: Info, color: 'text-slate-300', bg: 'bg-slate-600/15' },
};

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  open,
  inbox,
  archive,
  activeTab,
  onTabChange,
  onClose,
  onMarkAllRead,
  onArchiveAll,
  onArchive,
  onDelete,
  onMarkRead,
}) => {
  if (!open) return null;

  const list = activeTab === 'inbox' ? inbox : archive;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[1px] pointer-events-auto z-[80]"
        onClick={onClose}
      />
      <div className="pointer-events-auto absolute top-6 right-6 w-full max-w-md px-2 sm:px-4 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="rounded-3xl bg-slate-950 text-white border border-slate-800/80 shadow-2xl shadow-black/30 overflow-hidden backdrop-blur">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.2em]">
              <Bell size={16} className="text-amber-400" />
              <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                <button
                  className={`pb-1 border-b-2 transition-colors ${
                    activeTab === 'inbox'
                      ? 'border-white text-white'
                      : 'border-transparent hover:text-white/80'
                  }`}
                  onClick={() => onTabChange('inbox')}
                >
                  Inbox ({inbox.length})
                </button>
                <button
                  className={`pb-1 border-b-2 transition-colors ${
                    activeTab === 'archive'
                      ? 'border-white text-white'
                      : 'border-transparent hover:text-white/80'
                  }`}
                  onClick={() => onTabChange('archive')}
                >
                  Archive ({archive.length})
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {activeTab === 'inbox' && (
                <>
                  <button
                    onClick={onMarkAllRead}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
                  >
                    Mark all read
                  </button>
                  <button
                    onClick={onArchiveAll}
                    className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-white"
                  >
                    Archive all
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-800">
            {list.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-slate-600" />
                <p className="text-xs font-semibold uppercase tracking-[0.2em]">
                  {activeTab === 'archive' ? 'No archived items' : 'All caught up'}
                </p>
              </div>
            ) : (
              list.map((n) => {
                const cfg = iconConfig[n.type] || iconConfig.default;
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                      n.unread && activeTab === 'inbox' ? 'bg-slate-900' : 'bg-slate-900/80'
                    }`}
                    onClick={() => onMarkRead(n.id)}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${cfg.bg} ${cfg.color}`}>
                      <cfg.Icon size={18} />
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">
                            {n.title}
                            {n.unread && activeTab === 'inbox' && (
                              <span className="ml-2 inline-flex h-2 w-2 rounded-full bg-emerald-400 align-middle" />
                            )}
                          </p>
                          <p className="text-[11px] text-slate-400 leading-snug">{n.body}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 text-[11px] text-slate-400">
                          <span>{new Date(n.created_at).toLocaleString()}</span>
                          {activeTab === 'inbox' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchive(n.id);
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-200"
                            >
                              Archive
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(n.id);
                              }}
                              className="text-[10px] font-black uppercase tracking-widest text-rose-300 hover:text-rose-200"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
