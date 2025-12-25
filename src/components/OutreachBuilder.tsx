
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Send, 
  Sparkles, 
  Mail, 
  User, 
  CheckCircle, 
  Eye, 
  MessageSquare,
  Trash2,
  Search as SearchIcon,
  LayoutGrid,
  List,
  Trophy,
  MoreVertical,
  X,
  History,
  ArrowLeft,
  ExternalLink,
  ChevronRight,
  Zap
} from 'lucide-react';
import { Lead, Profile } from '../types';
import { generateOutreachEmail } from '../services/geminiService';
import { getPlanLimits } from '../lib/planLimits';
import { supabase } from '../lib/supabaseClient';

interface OutreachBuilderProps {
  leads: Lead[];
  onUpdateLead: (id: string, updates: Partial<Lead>) => void;
  onDeleteLead: (id: string) => void;
  profile?: Profile | null;
}

type OutreachFilter = 'drafts' | 'outbound' | 'replied' | 'all' | 'archived';
type ViewMode = 'list' | 'pipeline';

const OutreachBuilder: React.FC<OutreachBuilderProps> = ({ leads, onUpdateLead, onDeleteLead, profile }) => {
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sentSuccess, setSentSuccess] = useState(false);
  const [activeFilter, setActiveFilter] = useState<OutreachFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [manualPollLoading, setManualPollLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [archivedLeads, setArchivedLeads] = useState<Lead[]>([]);
  const [softDeletedArchiveIds, setSoftDeletedArchiveIds] = useState<Set<string>>(new Set());
  const archivedIds = useMemo(() => new Set(archivedLeads.map(a => a.id)), [archivedLeads]);
  const [archivedCount, setArchivedCount] = useState<number>(0);
  const filterCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      drafts: 0,
      outbound: 0,
      replied: 0,
      archived: archivedLeads.length || 0,
    };

    // Use a unique set of IDs across both sources so deletions in archivedLeads
    // immediately affect the "all" badge even if the parent `leads` prop
    // hasn't reconciled yet.
    const uniqueIds = new Set<string>();
    leads.forEach(l => uniqueIds.add(l.id));
    archivedLeads.forEach(a => uniqueIds.add(a.id));
    counts.all = uniqueIds.size;

    // For other badges (drafts/outbound/replied) only consider active (non-archived)
    leads.forEach(l => {
      const isArchived = archivedIds.has(l.id);
      if (!isArchived && l.status === 'approved') counts.drafts += 1;
      if (!isArchived && l.status === 'sent') counts.outbound += 1;
      if (!isArchived && l.status === 'responded') counts.replied += 1;
    });

    return counts;
  }, [leads, archivedLeads, archivedIds]);
  const [replyBody, setReplyBody] = useState('');
  const [isReplying, setIsReplying] = useState(false);
  const [isFetchingMessages, setIsFetchingMessages] = useState(false);
  const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
  const [isDeletingArchived, setIsDeletingArchived] = useState(false);
  const [isSmallScreen, setIsSmallScreen] = useState<boolean>(typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  const stripHtml = (html?: string | null) => {
    if (!html) return '';
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  };

  const trimQuoted = (text: string) => {
    const markers = ['On ', 'From:', 'wrote:'];
    let idx = -1;
    markers.forEach(marker => {
      const pos = text.indexOf(marker);
      if (pos !== -1 && (idx === -1 || pos < idx)) idx = pos;
    });
    if (idx > 0) return text.slice(0, idx).trim();
    return text;
  };

  const fetchMessages = async (leadId: string) => {
    setIsFetchingMessages(true);
    // First fetch the email_threads for this lead. RLS on email_messages is written
    // to check ownership via the thread -> lead relationship, so explicitly
    // resolving thread ids for the lead makes the messages query simpler and
    // avoids edge cases where messages have a gmail_thread_id but no thread_id.
    try {
      // Use server-side function to fetch messages. The function runs with
      // the service role key and validates ownership, avoiding client-side
      // RLS restrictions that appear to be blocking reads in some sessions.
      const includeArchived = archivedIds.has(leadId);
      const fn = await supabase.functions.invoke('outreach-messages', {
        method: 'POST',
        body: { leadId, includeArchived },
      });

      const fnPayload = (fn as any)?.data ?? (fn as any);
      const data = Array.isArray(fnPayload?.messages) ? fnPayload.messages : (Array.isArray(fnPayload) ? fnPayload : fnPayload?.data || []);
      const threads = Array.isArray(fnPayload?.threads) ? fnPayload.threads : [];
      const error = (fn as any)?.error || null;
      console.debug('fetchMessages (function) raw', { fn, data, threads, error });
      if (error) {
        console.error('fetchMessages error', error);
        return;
      }
      if (Array.isArray(data) && data.length > 0) {
        const rows = data.map((m: any) => ({
          ...m,
          gmail_thread_id: m.gmail_thread_id || m.email_threads?.thread_id || null,
        }));
        const threadIds = threads.map((t: any) => t.id).filter(Boolean);
        const gmailThreadIds = threads.map((t: any) => t.thread_id).filter(Boolean);
        console.debug('fetchMessages rows count', rows.length, { threadIds, gmailThreadIds });

        // Preserve any optimistic messages (temporary ids) that haven't been
        // reconciled with persisted rows. If an optimistic message has the same
        // gmail_message_id as a persisted row, prefer the persisted row.
        const optimisticItems = (messages || []).filter((mm: any) => typeof mm.id === 'string' && mm.id.startsWith('optimistic-'));
        const persistedByGmailId = new Set(rows.map((r: any) => r.gmail_message_id).filter(Boolean));
        const remainingOptimistic = optimisticItems.filter((o: any) => !persistedByGmailId.has(o.gmail_message_id));

        setMessages([...remainingOptimistic, ...rows]);
      }
    } catch (err) {
      console.error('fetchMessages unexpected error', err);
    }
    finally {
      setIsFetchingMessages(false);
    }
  };

  useEffect(() => {
    setArchivedCount(archivedLeads.length);
  }, [archivedLeads.length]);

  const fetchArchivedLeads = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', profile.id)
        // Only fetch archived rows that are NOT hidden from the UI.
        .not('archived_at', 'is', null)
        .eq('hidden_from_ui', false)
        .order('archived_at', { ascending: false });
      if (error) {
        console.error('fetchArchivedLeads error', error);
        return;
      }
      const mapped = (data || []).map((row: any) => ({
        id: row.id,
        placeId: row.place_id || undefined,
        name: row.name,
        category: row.category || 'Business',
        rating: Number(row.rating) || 0,
        lastScan: row.updated_at ? new Date(row.updated_at).toLocaleDateString() : 'Recently',
        createdAt: row.created_at ? new Date(row.created_at).getTime() : undefined,
        updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined,
        website: row.website || 'No website',
        email: row.email || undefined,
        address: row.address || undefined,
        lat: row.lat ?? undefined,
        lng: row.lng ?? undefined,
        status: row.status || 'pending',
        sentAt: row.sent_at ? new Date(row.sent_at).getTime() : undefined,
        draftSubject: row.draft_subject || undefined,
        draftBody: row.draft_body || undefined,
        archivedAt: row.archived_at || null,
        score: {
          design: row.score_design ?? 50,
          performance: row.score_performance ?? 50,
          reviews: row.score_reviews ?? 50,
          trust: row.score_trust ?? 50,
        },
        notes: row.notes || '',
      })) as Lead[];
      const visible = mapped.filter(r => !softDeletedArchiveIds.has(r.id));
      setArchivedLeads(visible);
      setArchivedCount(visible.length);
    } catch (err) {
      console.error('fetchArchivedLeads unexpected', err);
    }
  };

  const fetchArchivedCount = async () => {
    if (!profile?.id) return setArchivedCount(0);
    try {
      const { count, error } = await supabase
        .from('leads')
        .select('id', { count: 'exact', head: false })
        .eq('user_id', profile.id)
        .not('archived_at', 'is', null)
        .eq('hidden_from_ui', false);
      if (!error) {
        const adjusted = Math.max(0, (count || 0) - softDeletedArchiveIds.size);
        setArchivedCount(adjusted);
      }
    } catch (err) {
      console.warn('fetchArchivedCount error', err);
    }
  };

  useEffect(() => {
    void fetchArchivedCount();
  }, [profile?.id, Array.from(softDeletedArchiveIds).join(',')]);

  const ensureLeadEmail = async (leadId: string) => {
    if (recipientEmail) return;
    const { data } = await supabase.from('leads').select('email').eq('id', leadId).single();
    if (data?.email) setRecipientEmail(data.email);
  };

  const orderedMessages = useMemo(
    () =>
      [...messages].sort(
        (a, b) => new Date(a.sent_at).getTime() - new Date(b.sent_at).getTime()
      ),
    [messages]
  );
  const activeGmailThreadId = useMemo(
    () => messages.find((m) => m.gmail_thread_id)?.gmail_thread_id || null,
    [messages]
  );
  const lastInbound = useMemo(() => [...messages].find(m => m.direction === 'inbound'), [messages]);
  const lastSent = useMemo(() => [...messages].find(m => m.direction === 'sent'), [messages]);

  const outreachLeads = useMemo(() => 
    leads.filter(l => ['approved', 'sent', 'responded'].includes(l.status) && !archivedIds.has(l.id))
  , [leads, archivedIds]);

  const currentLead = useMemo(() => {
    const fromActive = outreachLeads.find(l => l.id === selectedLeadId);
    if (fromActive) return fromActive;
    const fromArchived = archivedLeads.find(l => l.id === selectedLeadId);
    if (fromArchived) return fromArchived;
    return null;
  }, [outreachLeads, archivedLeads, selectedLeadId]);

  useEffect(() => {
    if (currentLead) {
      setSubject(currentLead.draftSubject || '');
      setBody(currentLead.draftBody || '');
      setRecipientEmail(currentLead.email || '');
      setReplyBody('');
      fetchMessages(currentLead.id);
      ensureLeadEmail(currentLead.id);
    }
  }, [selectedLeadId, currentLead]);

  // Keep track of screen size so we can disable Pipeline on narrow viewports
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const small = window.innerWidth < 768; // md breakpoint
      setIsSmallScreen(small);
      if (small && viewMode === 'pipeline') setViewMode('list');
    };
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [viewMode]);

  // When the user selects Archived filter, fetch archived leads
  // Always keep archived leads loaded so they can be shown in their own
  // sidebar section regardless of the active filter.
  useEffect(() => {
    void fetchArchivedLeads();
  }, [profile?.id, leads.length, Array.from(softDeletedArchiveIds).join(',')]);

  useEffect(() => {
    if (!selectedLeadId && outreachLeads.length > 0) {
      setSelectedLeadId(outreachLeads[0].id);
    }
  }, [outreachLeads, selectedLeadId]);

  const getRatingColorClass = (rating: number) => {
    if (rating >= 4.0) return "text-emerald-500";
    if (rating >= 3.0) return "text-slate-400 dark:text-slate-600";
    return "text-rose-500";
  };

  const getStatusBadge = (lead: Lead) => {
    const baseClasses = "px-2 py-0.5 rounded text-[8px] font-black border uppercase tracking-widest shrink-0";
    if (lead.status === 'won') return <span className={`${baseClasses} bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/50`}>Won</span>;
    if (lead.status === 'stale') return <span className={`${baseClasses} bg-slate-50 dark:bg-slate-800/20 text-slate-600 dark:text-slate-300 border-slate-100 dark:border-slate-800`}>Stale</span>;
    if (lead.status === 'lost') return <span className={`${baseClasses} bg-rose-50 dark:bg-rose-900/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/30`}>Lost</span>;
    if (lead.status === 'responded') return <span className={`${baseClasses} bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50`}>Reply</span>;
    if (lead.status === 'approved') return <span className={`${baseClasses} bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-blue-100 dark:border-blue-900/50`}>Draft</span>;
    return <span className={`${baseClasses} bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-700`}>Sent</span>;
  };

  const handleGenerate = async () => {
    if (!currentLead) return;
    setIsGenerating(true);
    try {
      // Gate Gemini usage to plans that allow it (Studio+)
      const canUse = getPlanLimits(profile?.plan).canUseGemini;
      if (!canUse) {
        // Friendly UX: prompt upgrade — keep simple for now
        alert('Gemini-powered outreach is available for Studio and Agency+ plans. Upgrade in Settings to use this feature.');
        return;
      }

      const draft = await generateOutreachEmail(currentLead);
      setSubject(draft.subject);
      setBody(draft.body);
      onUpdateLead(currentLead.id, { draftSubject: draft.subject, draftBody: draft.body });
    } catch (err) { console.error(err); } finally { setIsGenerating(false); }
  };

  const handleGenerateReply = async () => {
    if (!currentLead) return;
    setIsGenerating(true);
    try {
      const canUse = getPlanLimits(profile?.plan).canUseGemini;
      if (!canUse) {
        alert('Gemini-powered outreach is available for Studio and Agency+ plans. Upgrade in Settings to use this feature.');
        return;
      }
      const draft = await generateOutreachEmail(currentLead);
      // Populate the quick-reply composer with the AI-generated body
      setReplyBody(draft.body || '');
    } catch (err) {
      console.error('generate reply failed', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!currentLead) return;
    if (!recipientEmail) {
      alert('Add a recipient email first.');
      return;
    }
    setIsSending(true);
    try {
      // If this lead is archived, optimistically move it back to active
      if ((currentLead as any).archivedAt) {
        setArchivedLeads(prev => prev.filter(p => p.id !== currentLead.id));
        setArchivedCount(c => Math.max(0, c - 1));
        // Optimistically mark as sent and un-archive locally via parent
        try { onUpdateLead(currentLead.id, { status: 'sent', archivedAt: null, sentAt: Date.now(), email: recipientEmail }); } catch (e) { /* ignore */ }
      }
      const fn = await supabase.functions.invoke('gmail-send', {
        body: {
          leadId: currentLead.id,
          to: recipientEmail,
          subject,
          html: body
        }
      });
      const resp = (fn as any)?.data || fn?.data || null;
      if (!resp || resp?.error) throw resp?.error || new Error('gmail-send failed');

      // Use the persisted DB row returned by the function. This ensures the
      // frontend displays server-persisted messages (authoritative) and avoids
      // relying solely on optimistic placeholders.
      const dbMessage = resp.dbMessage || resp.data?.dbMessage || null;
      const dbThread = resp.dbThread || resp.data?.dbThread || null;
      if (dbMessage) {
        setMessages(prev => [dbMessage, ...prev.filter((m: any) => m.id !== dbMessage.id)]);
      }
      onUpdateLead(currentLead.id, { 
        status: 'sent', 
        sentAt: Date.now(),
        draftSubject: subject,
        draftBody: body,
        email: recipientEmail
      });
      await fetchMessages(currentLead.id);
      setSentSuccess(true);
      setTimeout(() => setSentSuccess(false), 2000);
    } catch (err: any) {
      console.error(err);
      alert('Send failed. Make sure a Gmail account is connected.');
    } finally {
      setIsSending(false);
    }
  };

  const handleReply = async () => {
    if (!currentLead) return;
    const replyTo = (recipientEmail || currentLead.email || '').trim();
    if (!replyTo) {
      await ensureLeadEmail(currentLead.id);
      const fallback = (currentLead.email || recipientEmail || '').trim();
      if (fallback) {
        setRecipientEmail(fallback);
      }
      alert('Add a recipient email first.');
      return;
    }
    if (!replyBody.trim()) {
      alert('Add a reply message first.');
      return;
    }
    setIsReplying(true);
    try {
      // If this archived lead is being replied to, optimistically un-archive
      if ((currentLead as any).archivedAt) {
        setArchivedLeads(prev => prev.filter(p => p.id !== currentLead.id));
        setArchivedCount(c => Math.max(0, c - 1));
        try { onUpdateLead(currentLead.id, { status: 'responded', archivedAt: null }); } catch (e) { /* ignore */ }
      }
      const subjectLine = lastSent?.subject || currentLead.draftSubject || subject || '';
      const threadId = activeGmailThreadId || lastInbound?.gmail_thread_id || lastSent?.gmail_thread_id || null;
      const replyMsgIdHeader = lastInbound?.message_id_header || lastSent?.message_id_header || null;

      console.log('reply send', { threadId, to: replyTo, inReplyTo: replyMsgIdHeader });

      const fn = await supabase.functions.invoke('gmail-send', {
        body: {
          leadId: currentLead.id,
          to: replyTo,
          subject: subjectLine,
          html: replyBody,
          threadId: threadId || undefined,
          inReplyTo: replyMsgIdHeader || undefined,
          references: replyMsgIdHeader || undefined,
        },
      });
      const resp = (fn as any)?.data || fn?.data || null;
      if (!resp || resp?.error) throw resp?.error || new Error('gmail-send failed');

      const dbMessage = resp.dbMessage || resp.data?.dbMessage || null;
      if (dbMessage) {
        setMessages(prev => [dbMessage, ...prev.filter((m: any) => m.id !== dbMessage.id)]);
      }

      setReplyBody('');
      await fetchMessages(currentLead.id);
    } catch (err) {
      console.error(err);
      alert('Reply failed. Try again.');
    } finally {
      setIsReplying(false);
    }
  };

  const handleManualPoll = async () => {
    setManualPollLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-poll', {
        method: 'POST',
        body: {}
      });
      if (error) throw error;
      if (currentLead) await fetchMessages(currentLead.id);
    } catch (err: any) {
      console.error(err);
    } finally {
      setManualPollLoading(false);
    }
  };

  const handleDeleteCurrentLead = async () => {
    if (!currentLead) return;
    // If this is an archived lead, only remove it from the frontend list so
    // quota/usage tracking remains intact. Do NOT call the parent delete
    // handler which would remove it from the backend and affect usage.
    if ((currentLead as any).archivedAt) {
      // Optimistic UI update: remove locally first for immediate UX
      const previous = archivedLeads;
      setArchivedLeads(prev => prev.filter(p => p.id !== currentLead.id));
      setSoftDeletedArchiveIds(prev => {
        const s = new Set(prev);
        s.add(currentLead.id);
        return s;
      });
      setArchivedCount(c => Math.max(0, c - 1));
      // Clear selection to avoid showing stale UI
      setSelectedLeadId(null);

      // Persist the "hidden" state server-side so the row remains for quota
      // tracking but is hidden from UI across sessions/devices. If the RPC
      // fails, revert the optimistic UI changes and show an error.
      try {
        const { data, error } = await supabase.rpc('hide_lead', { p_lead_id: currentLead.id, p_hidden: true });
        if (error) {
          console.error('hide_lead rpc returned error', error);
          // revert optimistic change
          setArchivedLeads(previous);
          setSoftDeletedArchiveIds(prev => {
            const s = new Set(prev);
            s.delete(currentLead.id);
            return s;
          });
          setArchivedCount(previous.length);
          alert('Failed to hide archived lead: ' + (error.message || JSON.stringify(error)));
          return;
        }
        // success: reconcile by re-fetching authoritative archived rows
        try { void fetchArchivedLeads(); void fetchArchivedCount(); } catch (e) { /* ignore */ }
      } catch (err: any) {
        console.error('hide_lead rpc failed', err);
        // revert optimistic change
        setArchivedLeads(previous);
        setSoftDeletedArchiveIds(prev => {
          const s = new Set(prev);
          s.delete(currentLead.id);
          return s;
        });
        setArchivedCount(previous.length);
        alert('Failed to hide archived lead: ' + (err?.message || String(err)));
      }
      return;
    }

    // Non-archived leads: perform full delete (calls parent handler)
    setSelectedLeadId(null);
    try {
      await onDeleteLead(currentLead.id);
    } catch (err) {
      console.error('delete lead failed', err);
    } finally {
      try { void fetchArchivedLeads(); void fetchArchivedCount(); } catch (e) { /* ignore */ }
    }
  };

  // Confirmation flow: call this from the modal to reuse the same deletion
  // logic that currently lives in `handleDeleteCurrentLead`. This wrapper
  // ensures we can show a loading state inside the modal and close it when
  // the work completes.
  const confirmDeleteArchived = async () => {
    setIsDeletingArchived(true);
    try {
      await handleDeleteCurrentLead();
    } catch (err) {
      console.error('confirmDeleteArchived failed', err);
    } finally {
      setIsDeletingArchived(false);
      setShowConfirmDeleteModal(false);
    }
  };

  const navigateToSettingsProfile = () => {
    try {
      // Signal Settings to open the Profile tab after navigation
      localStorage.setItem('gridlead_return_view', 'settings');
      localStorage.setItem('gridlead_settings_tab', 'profile');
      // Perform a hard navigation to root so App will read the return_view
      // and open Settings. This is fast and avoids showing an underlined link.
      window.location.href = '/';
    } catch (err) {
      // Fallback: try SPA-style navigation
      try { window.location.assign('/'); } catch (e) { /* ignore */ }
    }
  };

  const handleRestoreCurrentLead = async () => {
    if (!currentLead) return;
    // Optimistically remove from archived list
    setArchivedLeads(prev => prev.filter(p => p.id !== currentLead.id));
    setArchivedCount(c => Math.max(0, c - 1));
    // If this was soft-deleted locally, remove it from that set so it can
    // reappear when restored.
    setSoftDeletedArchiveIds(prev => {
      const s = new Set(prev);
      s.delete(currentLead.id);
      return s;
    });
    // Ensure the hidden flag is cleared server-side so the lead reappears
    // for the user across sessions/devices.
    try {
      await supabase.rpc('hide_lead', { p_lead_id: currentLead.id, p_hidden: false });
    } catch (err) {
      console.error('unhide rpc failed', err);
    }
    try {
      // Restore to active by clearing archivedAt and setting status to 'sent'
      await onUpdateLead(currentLead.id, { archivedAt: null, status: 'sent' });
    } catch (err) {
      console.error('restore lead failed', err);
    } finally {
      try { void fetchArchivedLeads(); void fetchArchivedCount(); } catch (e) { /* ignore */ }
    }
  };

  // Outcome menu component (inline) - keeps appearance compact and calls onUpdateLead
  const OutcomeMenu: React.FC<{ lead: Lead; onUpdateLead: (id: string, updates: Partial<Lead>) => void }> = ({ lead, onUpdateLead }) => {
    const [open, setOpen] = useState(false);
    const ref = React.useRef<HTMLDivElement | null>(null);
    const toggle = () => setOpen(v => !v);
    const select = async (value: 'won'|'stale'|'lost') => {
      // Immediately reflect archiving in the UI by moving the lead into archivedLeads
      const now = new Date().toISOString();
      if (value === 'won' || value === 'stale' || value === 'lost') {
        setArchivedLeads(prev => {
          // if already present, update its status
          if (prev.some(p => p.id === lead.id)) {
            return prev.map(p => p.id === lead.id ? { ...p, status: value, archivedAt: now } : p);
          }
          return [{ ...lead, status: value, archivedAt: now }, ...prev];
        });
      } else {
        // if selecting a non-archived outcome, remove from archived local list
        setArchivedLeads(prev => prev.filter(p => p.id !== lead.id));
      }

      // Persist to server and refresh authoritative archived rows to ensure badges are correct
      try {
        await onUpdateLead(lead.id, { status: value });
      } catch (err) {
        console.error('Outcome update failed', err);
      } finally {
        setOpen(false);
        // reconcile local archived list with server state
        try { void fetchArchivedLeads(); void fetchArchivedCount(); } catch (e) { /* ignore */ }
      }
    };

    // Close on outside click
    useEffect(() => {
      const onDoc = (ev: MouseEvent) => {
        if (!ref.current) return;
        if (!ref.current.contains(ev.target as Node)) setOpen(false);
      };
      if (open) document.addEventListener('mousedown', onDoc);
      return () => document.removeEventListener('mousedown', onDoc);
    }, [open]);

    return (
      <div className="relative" ref={ref}>
        <button
          onClick={toggle}
          aria-haspopup="menu"
          aria-expanded={open}
          className="flex-1 lg:flex-none px-4 h-11 bg-amber-500 text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-md"
          title="Set outcome"
        >
          <MoreVertical size={16} />
        </button>
        {open && (
          <div role="menu" className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-lg shadow-xl z-50 py-1">
            <button role="menuitem" onClick={() => select('won')} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
              <Trophy size={16} className="text-amber-500" />
              <div>
                <div className="font-bold">Won</div>
                <div className="text-xs text-slate-400">Closed deal</div>
              </div>
            </button>
            <button role="menuitem" onClick={() => select('stale')} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
              <History size={16} className="text-slate-500" />
              <div>
                <div className="font-bold">Stale</div>
                <div className="text-xs text-slate-400">No recent activity</div>
              </div>
            </button>
            <button role="menuitem" onClick={() => select('lost')} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-3">
              <X size={16} className="text-rose-500" />
              <div>
                <div className="font-bold">Lost</div>
                <div className="text-xs text-slate-400">Lead uninterested</div>
              </div>
            </button>
          </div>
        )}
      </div>
    );
  };

  const filtered = useMemo(() => {
    // Archived is handled separately and sourced from archivedLeads
    if (activeFilter === 'archived') {
      return archivedLeads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return outreachLeads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'drafts') return l.status === 'approved';
      if (activeFilter === 'outbound') return l.status === 'sent';
      if (activeFilter === 'replied') return l.status === 'responded';
      return true;
    });
  }, [outreachLeads, activeFilter, searchQuery, archivedLeads]);

  const opportunities = useMemo(() => 
    filtered.filter(l => l.status === 'approved').reverse()
  , [filtered]);
  
  const activeThreads = useMemo(() => 
    filtered.filter(l => l.status !== 'approved').sort((a, b) => (b.sentAt || 0) - (a.sentAt || 0))
  , [filtered]);

  const PipelineView = () => {
    const columns = [
      { id: 'drafts', label: 'Drafts', leads: outreachLeads.filter(l => l.status === 'approved'), color: 'bg-blue-500' },
      { id: 'outbound', label: 'Outbound', leads: outreachLeads.filter(l => l.status === 'sent'), color: 'bg-slate-400' },
      { id: 'replied', label: 'Replied', leads: outreachLeads.filter(l => l.status === 'responded'), color: 'bg-emerald-500' },
      // 'Won' / 'Stale' / 'Lost' are archived-only statuses; include an Archived column
      { id: 'archived', label: 'Archived', leads: archivedLeads || [], color: 'bg-slate-500' },
    ];

    return (
      <div className="flex-1 overflow-hidden h-full bg-slate-50/10 dark:bg-slate-900/20 relative">
        <div className="h-full kanban-mask">
          {/* Scroll hint removed from PipelineView and moved next to the List/Pipeline toggle to avoid overlapping pipeline cards. */}

          <div className="overflow-x-auto h-full flex p-10 gap-8 custom-scrollbar kanban-scroll">
            {columns.map(col => (
              <div key={col.id} className="w-80 shrink-0 flex flex-col gap-6">
                <div className="flex items-center justify-between px-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
                    <span className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">{col.label}</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-300 dark:text-slate-700">{col.leads.length}</span>
                </div>
                <div className="flex-1 space-y-4 overflow-y-auto scrollbar-hide">
                    {col.leads.map(lead => (
                    <div 
                      key={lead.id} 
                      onClick={() => { setSelectedLeadId(lead.id); setViewMode('list'); setMobileView('detail'); }}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transform transition-all duration-200 cursor-pointer"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate pr-2">{lead.name}</p>
                        <span className={`text-[10px] font-mono font-bold ${getRatingColorClass(lead.rating)}`}>{lead.rating.toFixed(1)}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-600 uppercase tracking-widest">{lead.category}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const LeadCard = ({ lead }: { lead: Lead }) => (
    <div
      onClick={() => { setSelectedLeadId(lead.id); setMobileView('detail'); }}
      className={`w-full overflow-hidden p-4 md:p-5 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-all ${
        selectedLeadId === lead.id ? 'bg-white dark:bg-slate-900 shadow-sm z-10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
      }`}
    >
      <div className="flex items-center justify-between gap-4 min-w-0">
        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-center mb-1">
            <h3 className={`font-bold text-xs md:text-sm truncate pr-2 max-w-[140px] sm:max-w-[180px] md:max-w-[220px] ${archivedIds.has(lead.id) ? 'text-slate-400 dark:text-slate-600' : 'text-slate-900 dark:text-white'}`}>{lead.name}</h3>
            <div className={`text-[10px] md:text-[11px] font-mono font-extrabold ${getRatingColorClass(lead.rating)}`}>
              {lead.rating.toFixed(1)}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className={`text-[8px] md:text-[10px] uppercase tracking-widest truncate ${archivedIds.has(lead.id) ? 'text-slate-400 dark:text-slate-600' : 'text-slate-400 dark:text-slate-600'}`}>{lead.category}</p>
            {getStatusBadge(lead)}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] dark:text-white mb-2 tracking-tight">Outreach</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Manage threads and close high-value deals.</p>
        </div>
        
        {/* Scroll hint placed just left of the List/Pipeline toggle to avoid overlapping pipeline cards */}
        <div className="hidden md:flex items-center gap-2 mr-3 pointer-events-none">
          <style>{`
            @keyframes slideRight {
              0% { transform: translateX(0); opacity: 0; }
              30% { opacity: 1; }
              100% { transform: translateX(14px); opacity: 0; }
            }
            .pipeline-scroll svg { color: rgba(148,163,184,0.9); animation: slideRight 1.2s ease-in-out infinite; }
          `}</style>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Scroll</div>
          <div className="pipeline-scroll"><ChevronRight size={18} /></div>
        </div>

        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl w-fit border border-slate-200 dark:border-slate-800 shadow-inner">
          <button
            onClick={() => setViewMode('list')}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}
          >
            <List size={16} /> List
          </button>
          <button
            onClick={() => { if (!isSmallScreen) setViewMode('pipeline'); }}
            disabled={isSmallScreen}
            title={isSmallScreen ? 'Pipeline view is available on wider screens' : 'Pipeline'}
            className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'pipeline' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'} ${isSmallScreen ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <LayoutGrid size={16} /> Pipeline
          </button>
        </div>
        
      </div>

      <div className="flex border border-slate-200 dark:border-slate-800 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-950 shadow-xl shadow-slate-200/50 dark:shadow-black/50 min-h-[500px] md:h-[680px] relative ring-1 ring-slate-100/50 dark:ring-slate-800/50">
        
        {viewMode === 'pipeline' ? (
          <PipelineView />
        ) : (
          <div className="flex w-full h-full">
            {/* Sidebar Column */}
            <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-100 dark:border-slate-800 flex-col bg-slate-50/20 dark:bg-slate-900/20 shrink-0`}>
              <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 space-y-4">
                <div className="relative">
                  <SearchIcon size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" />
                  <input 
                    type="text" 
                    placeholder="Search leads..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-[10px] font-bold text-slate-900 dark:text-white focus:ring-1 focus:ring-slate-900/10 transition-all"
                  />
                </div>
                <div className="relative">
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide pr-2">
                    {(['all', 'drafts', 'outbound', 'replied', 'archived'] as OutreachFilter[]).map(f => (
                    <button 
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 ${activeFilter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                      <span className="inline-flex items-center gap-2">
                        <span>{f.replace('drafts', 'Drafts').replace('outbound', 'Outbound').replace('replied', 'Replied').replace('archived', 'Archived')}</span>
                        {filterCounts[f] > 0 && (
                          <span className="text-[10px] font-bold bg-slate-900 text-white rounded-full px-2 py-0.5">{filterCounts[f]}</span>
                        )}
                      </span>
                    </button>
                  ))}
                    </div>

                  {/* Left fade to hint horizontal scroll */}
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 hidden sm:block z-10">
                    <div className="h-full w-full bg-gradient-to-r from-white/90 to-transparent dark:from-slate-900/90 dark:to-transparent" />
                  </div>

                  {/* Right fade to hint horizontal scroll */}
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 hidden sm:block z-10">
                    <div className="h-full w-full bg-gradient-to-l from-white/90 to-transparent dark:from-slate-900/90 dark:to-transparent" />
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {opportunities.length > 0 && (activeFilter !== 'archived') && (activeFilter === 'all' || activeFilter === 'drafts') && (
                  <>
                    <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/50">
                      <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={12} fill="currentColor" /> New Opportunities
                      </span>
                    </div>
                    {opportunities.map(lead => <LeadCard key={lead.id} lead={lead} />)}
                  </>
                )}
                
                {(activeFilter !== 'archived') && activeThreads.length > 0 && (
                  <>
                    <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/50 mt-2 first:mt-0">
                          <span className="text-[9px] font-black text-emerald-400 dark:text-emerald-300 uppercase tracking-widest flex items-center gap-2">
                            <History size={12} className="text-emerald-400" /> Active Threads
                          </span>
                        </div>
                    {activeThreads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
                  </>
                )}
                            {(() => {
                                const archivedVisible = activeFilter === 'all' || activeFilter === 'archived';
                                if (!archivedVisible) return null;
                                if (!archivedLeads || archivedLeads.length === 0) return null;
                                // When searching, only show archived leads that match the query
                                const archivedFiltered = archivedLeads.filter(l => l.name.toLowerCase().includes(searchQuery.toLowerCase()));
                                if (archivedFiltered.length === 0) return null;
                                return (
                                  <>
                                    <div className="px-6 py-2 bg-slate-50/50 dark:bg-slate-900/50 mt-2 first:mt-0">
                                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest flex items-center gap-2">
                                        <History size={12} /> Archived Threads
                                      </span>
                                    </div>
                                    {archivedFiltered.map(lead => (
                                      <LeadCard key={lead.id} lead={lead} />
                                    ))}
                                  </>
                                );
                            })()}
                
                {filtered.length === 0 && (
                  <div className="py-20 text-center opacity-20">
                    <Mail size={32} className="mx-auto mb-2" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Inbox Empty</p>
                  </div>
                )}
              </div>
            </div>

            {/* Workspace Column */}
            <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-slate-900 overflow-hidden relative`}>
              {sentSuccess && (
                <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                  <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 border border-blue-100 dark:border-blue-900/50 shadow-lg">
                    <CheckCircle size={28} />
                  </div>
                  <h3 className="text-lg font-extrabold text-[#0f172a] dark:text-white">Sequence Active</h3>
                </div>
              )}

              {currentLead ? (
                <div className="flex-1 flex flex-col min-h-0 animate-in fade-in slide-in-from-right-2 duration-300">
                  {/* Workspace Header */}
                  <div className="p-6 md:p-10 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
                    <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                      <div className="flex-1 min-w-0 pr-0 lg:pr-6">
                        <button onClick={() => setMobileView('list')} className="md:hidden flex items-center gap-2 text-slate-400 dark:text-slate-600 font-bold text-[10px] uppercase tracking-widest mb-4">
                          <ArrowLeft size={14} /> Back to List
                        </button>
                        <div className="flex items-baseline gap-4 mb-2">
                          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate leading-tight max-w-[420px] md:max-w-[640px]">{currentLead.name}</h2>
                          <div className={`text-lg font-mono font-extrabold shrink-0 ${getRatingColorClass(currentLead.rating)}`}>
                            {currentLead.rating.toFixed(1)}
                          </div>
                          {getStatusBadge(currentLead)}
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                              <a href={`https://${currentLead.website}`} target="_blank" className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold underline underline-offset-4 truncate max-w-[240px]">
                                {currentLead.website} <ExternalLink size={10} />
                              </a>
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest truncate max-w-[140px]">• {currentLead.category}</span>
                                {(currentLead.email || recipientEmail) && (
                                  <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-600 truncate max-w-[140px]">• {currentLead.email || recipientEmail}</span>
                                )}
                              </div>
                            </div>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 w-full lg:w-auto">
                        <button
                          onClick={() => {
                            if (currentLead?.archivedAt) {
                              setShowConfirmDeleteModal(true);
                            } else {
                              void handleDeleteCurrentLead();
                            }
                          }}
                          className="flex-1 lg:flex-none px-6 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                          {(currentLead && !currentLead.archivedAt && (currentLead.sentAt || ['sent','responded'].includes(currentLead.status))) && (
                          <OutcomeMenu lead={currentLead} onUpdateLead={onUpdateLead} />
                        )}
                          {currentLead?.archivedAt && (
                            <button onClick={handleRestoreCurrentLead} className="flex-1 lg:flex-none px-6 h-11 bg-emerald-500 text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-emerald-600 transition-all">
                              Restore
                            </button>
                          )}

                        {(!currentLead.archivedAt && currentLead.status === 'won') && (
                          <div className="px-8 h-11 bg-amber-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-3 shadow-lg">
                            <Trophy size={18} /> Closed Won
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-slate-50/10 dark:bg-slate-950 pb-48">
                    <div className="max-w-4xl mx-auto space-y-8">
                      { (['sent', 'responded'].includes(currentLead.status) || currentLead.archivedAt) ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            {isFetchingMessages ? (
                              <div className="flex items-center gap-3 animate-pulse">
                                <div className="h-4 w-4 bg-slate-200 dark:bg-slate-700 rounded" />
                                <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                              </div>
                            ) : (
                              <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                <Mail size={14} className="text-blue-500" /> Thread Timeline
                              </div>
                            )}
                          </div>

                          {isFetchingMessages ? (
                            <div className="space-y-4">
                              {[1,2,3].map(i => (
                                <div key={i} className="p-6 rounded-3xl border border-slate-800 bg-slate-800/60 animate-pulse">
                                  <div className="h-4 bg-slate-700 rounded w-1/3 mb-4" />
                                  <div className="h-3 bg-slate-700 rounded w-1/6 mb-3" />
                                  <div className="h-12 bg-slate-700 rounded" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {orderedMessages.map(msg => (
                                <div
                                  key={msg.id}
                                  className={`p-6 rounded-3xl border shadow-sm ${
                                    msg.direction === 'sent'
                                      ? 'bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800'
                                      : 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-900/30'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-slate-500 dark:text-slate-400">
                                      {msg.direction === 'sent' ? (
                                        <>
                                          <Mail size={12} className="text-blue-500" /> Outbound
                                        </>
                                      ) : (
                                        <>
                                          <MessageSquare size={12} className="text-emerald-500" /> Incoming
                                        </>
                                      )}
                                    </div>
                                    <span className="text-[10px] font-mono text-slate-400">
                                      {new Date(msg.sent_at).toLocaleString()}
                                    </span>
                                  </div>
                                  {msg.subject && (
                                    <h4 className="text-base font-extrabold text-[#0f172a] dark:text-white mb-2 leading-tight">
                                      {msg.subject}
                                    </h4>
                                  )}
                                  <p className="text-[14px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium whitespace-pre-wrap">
                                    {trimQuoted(stripHtml(msg.body_html) || msg.snippet || '—')}
                                  </p>
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="sticky bottom-0 left-0 right-0 mt-6">
                            <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-6 sm:p-8 pb-12 sm:pb-14">
                              <div className="flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                  <div className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                    <MessageSquare size={14} /> Reply in thread
                                  </div>
                                  <button
                                    onClick={handleManualPoll}
                                    disabled={manualPollLoading}
                                    className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all"
                                  >
                                    {manualPollLoading ? 'Checking...' : 'Check replies'}
                                    <ChevronRight size={12} />
                                  </button>
                                </div>
                                <textarea
                                  value={replyBody}
                                  onChange={(e) => setReplyBody(e.target.value)}
                                  placeholder="Type a quick reply..."
                                  className="w-full h-24 sm:h-28 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900/10 dark:focus:ring-white/10"
                                />
                                <div className="flex justify-end items-center gap-3">
                                  <button
                                    onClick={handleGenerateReply}
                                    disabled={isGenerating}
                                    className="px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0f172a] dark:text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                                  >
                                    {isGenerating ? <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 dark:border-t-white rounded-full animate-spin" /> : <><Sparkles size={14} /> AI</>}
                                  </button>
                                  <button
                                    onClick={handleReply}
                                    disabled={isReplying || !replyBody}
                                    className="px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
                                  >
                                    {isReplying ? 'Sending...' : <><Send size={14} /> Send Reply</>}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-8">
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 flex items-center gap-3"><Mail size={16} /> Recipient Email</label>
                            <input 
                              type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} placeholder="owner@example.com"
                              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-6 py-5 text-sm font-bold text-[#0f172a] dark:text-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all shadow-inner"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 flex items-center gap-3"><Eye size={16} /> Subject Line</label>
                            <input 
                              type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Captivate their attention..."
                              className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl px-6 py-5 text-sm font-bold text-[#0f172a] dark:text-white focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all shadow-inner"
                            />
                          </div>
                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-600 px-2 flex items-center gap-3"><MessageSquare size={16} /> Email Body</label>
                            <textarea 
                              value={body} onChange={(e) => setBody(e.target.value)} placeholder="Craft your master pitch..."
                              className="w-full h-80 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] p-8 text-lg text-slate-700 dark:text-slate-300 font-medium leading-relaxed focus:outline-none focus:ring-4 focus:ring-slate-900/5 dark:focus:ring-white/5 transition-all resize-none shadow-inner"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer Action Area */}
                      {(!currentLead.archivedAt && !['sent', 'responded'].includes(currentLead.status)) && (
                        <div className="absolute bottom-0 left-0 right-0 pt-8 pb-10 px-6 md:pt-10 md:pb-12 md:px-8 bg-gradient-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent pointer-events-none z-20">
                          <div className="max-w-4xl mx-auto pointer-events-auto flex gap-4">
                            <button 
                              onClick={handleSend} disabled={isSending || !subject || !body}
                              className="flex-1 h-16 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-2xl active:scale-95 ring-4 ring-slate-900/5 dark:ring-white/5"
                            >
                              {isSending ? "Dispatching..." : <><Send size={20} /> Initiate Thread</>}
                            </button>
                            <button
                              onClick={handleGenerate}
                              disabled={isGenerating}
                              className="h-16 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0f172a] dark:text-white rounded-xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-all"
                            >
                              {isGenerating ? <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 dark:border-t-white rounded-full animate-spin" /> : <><Sparkles size={14} /> AI Craft</>}
                            </button>
                          </div>
                        </div>
                      )}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-20 opacity-30">
                  <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center text-slate-300 dark:text-slate-700 mb-8 border border-slate-100 dark:border-slate-800 shadow-inner">
                    <User size={32} />
                  </div>
                  <h3 className="text-xl font-black text-[#0f172a] dark:text-white tracking-tight">Select a Lead</h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Choose an opportunity to start a thread</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Floating reply composer for existing threads */}
    {showConfirmDeleteModal && currentLead && currentLead.archivedAt && (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { if (!isDeletingArchived) setShowConfirmDeleteModal(false); }} />
        <div className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-lg w-full p-8 md:p-10 z-10 animate-in fade-in zoom-in duration-200 transform-gpu">
          <h3 className="text-lg font-extrabold mb-2">Delete Archived Thread</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 leading-relaxed">
            Deleting this archived thread will permanently remove it from your account and cannot be recovered. It will still count toward your usage quota.
          </p>
          <p className="text-sm text-slate-500 dark:text-slate-500 mb-6">
            Need more quota? Consider upgrading your plan in{' '}
            <span
              role="button"
              tabIndex={0}
              onClick={() => navigateToSettingsProfile()}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') navigateToSettingsProfile(); }}
              className="inline-flex items-center px-3 py-1 rounded-md bg-slate-900/10 dark:bg-slate-800 text-slate-900 dark:text-white font-bold hover:bg-slate-900/20 dark:hover:bg-slate-700 transition-colors duration-150 cursor-pointer"
            >
              Settings
            </span>
            .
          </p>
          <div className="flex justify-end gap-4">
            <button
              onClick={() => setShowConfirmDeleteModal(false)}
              disabled={isDeletingArchived}
              className="px-6 py-3 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors duration-150 active:scale-95 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            >
              Cancel
            </button>
            <button
              onClick={() => { void confirmDeleteArchived(); }}
              disabled={isDeletingArchived}
              className="px-6 py-3 rounded-full bg-rose-600 text-white hover:bg-rose-700 transition-colors duration-150 active:scale-95 focus:outline-none focus:ring-4 focus:ring-rose-600/30"
            >
              {isDeletingArchived ? 'Deleting...' : 'Delete permanently'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

export default OutreachBuilder;
