import React, { useEffect, useState } from 'react';
import {
  Bell,
  X,
  Info,
  AlertTriangle,
  MessageSquare,
  Target,
  AlertOctagon,
  Archive as ArchiveIcon,
  Trash2,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
} from 'lucide-react';
import type { NotificationItem } from '../types';

interface NotificationCenterProps {
  open: boolean;
  inbox: NotificationItem[];
  archive: NotificationItem[];
  activeTab: 'inbox' | 'archive';
  onTabChange: (tab: 'inbox' | 'archive') => void;
  onClose: () => void;
  onMarkAllRead: () => void;
  onArchiveAll: () => void;
  onDeleteAll: () => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
  onMarkRead: (id: string) => void;
}

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  const week = Math.floor(day / 7);
  if (week > 0) return `${week}w ago`;
  if (day > 0) return `${day}d ago`;
  if (hr > 0) return `${hr}h ago`;
  if (min > 0) return `${min}m ago`;
  return 'Just now';
};

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
  onDeleteAll,
  onArchive,
  onDelete,
  onMarkRead,
}) => {
  const [visible, setVisible] = useState(open);
  const [animateIn, setAnimateIn] = useState(open);

  useEffect(() => {
    if (open) {
      setVisible(true);
      requestAnimationFrame(() => setAnimateIn(true));
    } else {
      setAnimateIn(false);
      const t = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!visible) return null;

  const list = activeTab === 'inbox' ? inbox : archive;

  return (
    <div className="fixed inset-0 z-[90] pointer-events-none">
      <div
        className="absolute inset-0 bg-slate-900/30 pointer-events-auto z-[80]"
        onClick={onClose}
      />
      <div
        className={`pointer-events-auto absolute top-6 right-6 w-full max-w-md px-2 sm:px-4 z-[95] transition-all duration-200 ease-out transform ${
          animateIn ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
        }`}
      >
        <div className="rounded-3xl bg-slate-950 text-white border border-slate-800/80 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65)] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
            <div className="flex items-center gap-3 text-sm font-semibold">
              <Bell size={16} className="text-amber-400" />
              <div className="flex items-center gap-4 text-xs font-semibold text-slate-300">
                <button
                  className={`relative pb-3 transition-colors ${
                    activeTab === 'inbox'
                      ? 'text-white after:absolute after:left-0 after:right-0 after:bottom-[-2px] after:h-[2px] after:bg-emerald-400 after:rounded-full'
                      : 'text-slate-400 hover:text-white/80'
                  }`}
                  onClick={() => onTabChange('inbox')}
                >
                  <span className="inline-flex items-center gap-2 align-middle">
                    <span>Inbox</span>
                    <span className="bg-slate-800 text-white rounded-full px-2 py-[2px] text-[10px] font-semibold">
                      {inbox.length}
                    </span>
                  </span>
                </button>
                <button
                  className={`relative pb-3 transition-colors ${
                    activeTab === 'archive'
                      ? 'text-white after:absolute after:left-0 after:right-0 after:bottom-[-2px] after:h-[2px] after:bg-emerald-400 after:rounded-full'
                      : 'text-slate-400 hover:text-white/80'
                  }`}
                  onClick={() => onTabChange('archive')}
                >
                  <span className="inline-flex items-center gap-2">
                    <span>Archive</span>
                    <span className="bg-slate-800 text-white rounded-full px-2 py-[2px] text-[10px] font-semibold">
                      {archive.length}
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-transform duration-150 hover:rotate-90"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="max-h-[520px] overflow-y-auto divide-y divide-slate-800">
            {list.length === 0 ? (
              <div className="p-8 text-center text-slate-500 flex flex-col items-center gap-2">
                <CheckCircle2 size={24} className="text-slate-600" />
                <p className="text-xs font-semibold">
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold truncate">{n.title}</p>
                          <p className="text-[11px] text-slate-400 leading-snug">{n.body}</p>
                          <p className="text-[11px] text-slate-500 mt-1">{timeAgo(n.created_at)}</p>
                        </div>
                        <div className="flex-shrink-0">
                          {activeTab === 'inbox' ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onArchive(n.id);
                              }}
                              className="text-slate-300 hover:text-white"
                              aria-label="Archive"
                            >
                              <ArchiveIcon size={14} />
                            </button>
                          ) : (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDelete(n.id);
                              }}
                              className="text-slate-300 hover:text-white"
                              aria-label="Delete"
                            >
                              <Trash2 size={14} />
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
          {activeTab === 'inbox' && list.length > 0 && (
            <div className="border-t border-slate-800 bg-slate-900/80 px-5 py-3 flex items-center justify-between text-[11px]">
              <button
                onClick={onMarkAllRead}
                className="text-slate-300 hover:text-white font-semibold"
              >
                Mark all read
              </button>
              <button
                onClick={onArchiveAll}
                className="text-slate-300 hover:text-white font-semibold"
              >
                Archive all
              </button>
            </div>
          )}
          {activeTab === 'archive' && list.length > 0 && (
            <div className="border-t border-slate-800 bg-slate-900/80 px-5 py-3 flex items-center justify-end text-[11px]">
              <button
                onClick={onDeleteAll}
                className="text-slate-300 hover:text-white font-semibold"
              >
                Delete all
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NotificationCenter;
