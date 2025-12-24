
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

type OutreachFilter = 'drafts' | 'outbound' | 'replied' | 'won' | 'all';
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
  const [replyBody, setReplyBody] = useState('');
  const [isReplying, setIsReplying] = useState(false);

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
    // First fetch the email_threads for this lead. RLS on email_messages is written
    // to check ownership via the thread -> lead relationship, so explicitly
    // resolving thread ids for the lead makes the messages query simpler and
    // avoids edge cases where messages have a gmail_thread_id but no thread_id.
    try {
      const { data: threads, error: threadErr } = await supabase
        .from('email_threads')
        .select('id,thread_id')
        .eq('lead_id', leadId);
      if (threadErr) {
        console.error('fetchMessages thread load error', threadErr);
        return;
      }

      console.debug('fetchMessages threads raw', { threads });

      const threadIds = (threads || []).map((t: any) => t.id).filter(Boolean);
      const gmailThreadIds = (threads || []).map((t: any) => t.thread_id).filter(Boolean);

      // Build filters depending on what we found. We want messages that are:
      // - Attached to any of the lead's thread rows (thread_id IN ...)
      // - OR have a gmail_thread_id matching the Gmail thread id from those threads
      // If there are no threads, fall back to messages where thread_id IS NULL (or none)
      let messagesQuery = supabase
        .from('email_messages')
        .select('id,direction,snippet,subject,sent_at,body_html,gmail_message_id,gmail_thread_id,message_id_header,thread_id,email_threads(id,lead_id,thread_id)')
        .order('sent_at', { ascending: false })
        .limit(100);

      const orParts: string[] = [];
      if (threadIds.length > 0) {
        const threadCsv = threadIds.map((s: string) => `"${s}"`).join(',');
        orParts.push(`thread_id.in.(${threadCsv})`);
      }
      if (gmailThreadIds.length > 0) {
        const gmailCsv = gmailThreadIds.map((s: string) => `"${s}"`).join(',');
        orParts.push(`gmail_thread_id.in.(${gmailCsv})`);
      }
      if (orParts.length === 0) {
        // No threads found for this lead — attempt to surface messages without a thread row
        orParts.push('thread_id.is.null');
      }

      const orFilter = orParts.join(',');
      console.debug('fetchMessages orFilter', orFilter, { threadIds, gmailThreadIds });

      const { data, error } = await messagesQuery.or(orFilter);
      console.debug('fetchMessages messages raw', { data, error });
      if (error) {
        console.error('fetchMessages error', error);
        return;
      }
      if (data) {
        const rows = data.map((m: any) => ({
          ...m,
          gmail_thread_id: m.gmail_thread_id || m.email_threads?.thread_id || null,
        }));
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
  };

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
    leads.filter(l => ['approved', 'sent', 'responded', 'won'].includes(l.status))
  , [leads]);

  const currentLead = useMemo(() => 
    outreachLeads.find(l => l.id === selectedLeadId) || null
  , [outreachLeads, selectedLeadId]);

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

  const handleSend = async () => {
    if (!currentLead) return;
    if (!recipientEmail) {
      alert('Add a recipient email first.');
      return;
    }
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('gmail-send', {
        body: {
          leadId: currentLead.id,
          to: recipientEmail,
          subject,
          html: body
        }
      });
      if (error) throw error;

      // Optimistic UI: show the sent message immediately while the backend
      // persists and we fetch canonical rows. The function typically returns
      // a `sendJson` with `id` and `threadId` when Gmail accepts the message.
      try {
        const payload = (data as any) || {};
        const sendJson = payload.sendJson || payload.data || payload.body || payload;
        const gmailId = sendJson?.id || sendJson?.gmail_message_id || null;
        const gmailThread = sendJson?.threadId || sendJson?.thread_id || null;
        const optimistic: any = {
          id: `optimistic-${Date.now()}`,
          direction: 'sent',
          subject,
          snippet: stripHtml(body).slice(0, 200),
          sent_at: new Date().toISOString(),
          body_html: body,
          gmail_message_id: gmailId,
          gmail_thread_id: gmailThread,
          thread_id: null,
        };
        setMessages(prev => [optimistic, ...prev]);
      } catch (e) {
        console.debug('optimistic insert failed', e);
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
      const subjectLine = lastSent?.subject || currentLead.draftSubject || subject || '';
      const threadId = activeGmailThreadId || lastInbound?.gmail_thread_id || lastSent?.gmail_thread_id || null;
      const replyMsgIdHeader = lastInbound?.message_id_header || lastSent?.message_id_header || null;

      console.log('reply send', { threadId, to: replyTo, inReplyTo: replyMsgIdHeader });

      const { data, error } = await supabase.functions.invoke('gmail-send', {
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
      if (error) throw error;

      // Optimistic UI for replies as well
      try {
        const payload = (data as any) || {};
        const sendJson = payload.sendJson || payload.data || payload.body || payload;
        const gmailId = sendJson?.id || sendJson?.gmail_message_id || null;
        const gmailThread = sendJson?.threadId || sendJson?.thread_id || threadId || null;
        const optimistic: any = {
          id: `optimistic-${Date.now()}`,
          direction: 'sent',
          subject: subjectLine,
          snippet: stripHtml(replyBody).slice(0, 200),
          sent_at: new Date().toISOString(),
          body_html: replyBody,
          gmail_message_id: gmailId,
          gmail_thread_id: gmailThread,
          thread_id: null,
        };
        setMessages(prev => [optimistic, ...prev]);
      } catch (e) {
        console.debug('optimistic reply insert failed', e);
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

  const filtered = useMemo(() => {
    return outreachLeads.filter(l => {
      const matchesSearch = l.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;
      if (activeFilter === 'all') return true;
      if (activeFilter === 'drafts') return l.status === 'approved';
      if (activeFilter === 'outbound') return l.status === 'sent';
      if (activeFilter === 'replied') return l.status === 'responded';
      if (activeFilter === 'won') return l.status === 'won';
      return true;
    });
  }, [outreachLeads, activeFilter, searchQuery]);

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
      { id: 'won', label: 'Closed Won', leads: outreachLeads.filter(l => l.status === 'won'), color: 'bg-amber-500' },
    ];

    return (
      <div className="flex-1 overflow-hidden h-full bg-slate-50/10 dark:bg-slate-900/20">
        <div className="h-full kanban-mask">
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
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer"
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
      className={`p-5 md:p-6 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-all ${
        selectedLeadId === lead.id ? 'bg-white dark:bg-slate-900 shadow-sm z-10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
      }`}
    >
      <div className="flex justify-between items-center mb-1">
        <h3 className="font-bold text-xs md:text-sm truncate text-slate-900 dark:text-white pr-2">{lead.name}</h3>
        <div className={`text-[10px] md:text-[11px] font-mono font-extrabold ${getRatingColorClass(lead.rating)}`}>
          {lead.rating.toFixed(1)}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[8px] md:text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-widest truncate">{lead.category}</p>
        {getStatusBadge(lead)}
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
        
        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-2xl w-fit border border-slate-200 dark:border-slate-800 shadow-inner">
          <button onClick={() => setViewMode('list')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
            <List size={16} /> List
          </button>
          <button onClick={() => setViewMode('pipeline')} className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2 transition-all ${viewMode === 'pipeline' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400 dark:text-slate-500'}`}>
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
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {(['all', 'drafts', 'outbound', 'replied', 'won'] as OutreachFilter[]).map(f => (
                    <button 
                      key={f}
                      onClick={() => setActiveFilter(f)}
                      className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest border transition-all shrink-0 ${activeFilter === f ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-md' : 'bg-white dark:bg-slate-800 text-slate-400 dark:text-slate-600 border-slate-100 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}`}
                    >
                      {f.replace('drafts', 'Drafts').replace('outbound', 'Outbound').replace('replied', 'Replied').replace('won', 'Won')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {opportunities.length > 0 && (activeFilter === 'all' || activeFilter === 'drafts') && (
                  <>
                    <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-50 dark:border-slate-800">
                      <span className="text-[9px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2">
                        <Zap size={12} fill="currentColor" /> New Opportunities
                      </span>
                    </div>
                    {opportunities.map(lead => <LeadCard key={lead.id} lead={lead} />)}
                  </>
                )}
                
                {(activeFilter === 'all' || activeFilter !== 'drafts') && activeThreads.length > 0 && (
                  <>
                    <div className="px-6 py-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-50 dark:border-slate-800 mt-4 first:mt-0">
                      <span className="text-[9px] font-black text-slate-400 dark:text-slate-600 uppercase tracking-widest flex items-center gap-2">
                        <History size={12} /> Active Threads
                      </span>
                    </div>
                    {activeThreads.map(lead => <LeadCard key={lead.id} lead={lead} />)}
                  </>
                )}
                
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
                          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate leading-tight">{currentLead.name}</h2>
                          <div className={`text-lg font-mono font-extrabold shrink-0 ${getRatingColorClass(currentLead.rating)}`}>
                            {currentLead.rating.toFixed(1)}
                          </div>
                          {getStatusBadge(currentLead)}
                        </div>
                        <div className="flex items-center gap-4">
                          <a href={`https://${currentLead.website}`} target="_blank" className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold underline underline-offset-4 truncate">
                            {currentLead.website} <ExternalLink size={10} />
                          </a>
                          <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">• {currentLead.category}</span>
                        </div>
                      </div>
                      
                      <div className="flex gap-3 w-full lg:w-auto">
                        <button onClick={() => onDeleteLead(currentLead.id)} className="flex-1 lg:flex-none px-6 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-600 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all">
                          <Trash2 size={18} />
                        </button>
                        <button 
                          onClick={() => onUpdateLead(currentLead.id, { status: 'won' })} 
                          className="flex-1 lg:flex-none px-4 h-11 bg-amber-500 text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-amber-600 transition-all flex items-center justify-center gap-2 shadow-md"
                          title="Mark as Closed Won"
                        >
                          <Trophy size={16} />
                        </button>
                        {!['sent', 'responded', 'won'].includes(currentLead.status) && (
                          <button 
                            onClick={handleGenerate} 
                            disabled={isGenerating}
                            className="flex-[2] lg:flex-none h-11 px-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[#0f172a] dark:text-white rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-3 shadow-md"
                          >
                            {isGenerating ? <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-900 dark:border-t-white rounded-full animate-spin" /> : <><Sparkles size={16} fill="currentColor" /> AI Craft</>}
                          </button>
                        )}
                        {currentLead.status === 'won' && (
                           <div className="px-8 h-11 bg-amber-500 text-white rounded-xl text-[10px] font-bold flex items-center gap-3 shadow-lg">
                              <Trophy size={18} /> Closed Won
                           </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Editor Body */}
                  <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-10 custom-scrollbar bg-slate-50/10 dark:bg-slate-950 pb-32">
                    <div className="max-w-4xl mx-auto space-y-8">
                      {['sent', 'responded', 'won'].includes(currentLead.status) ? (
                        <div className="space-y-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
                              <Mail size={14} className="text-blue-500" /> Thread Timeline
                            </div>
                            <button
                              onClick={handleManualPoll}
                              disabled={manualPollLoading}
                              className="text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 flex items-center gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                            >
                              {manualPollLoading ? 'Checking...' : 'Check replies'}
                              <ChevronRight size={12} />
                            </button>
                          </div>

                          {orderedMessages.length === 0 && (
                            <div className="p-8 border border-slate-100 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 text-sm">
                              No thread messages yet. Send or poll to see updates.
                            </div>
                          )}

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

                          <div className="sticky bottom-0 left-0 right-0 mt-6">
                            <div className="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg p-4 sm:p-6">
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
                                <div className="flex justify-end">
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
                  {!['sent', 'responded', 'won'].includes(currentLead.status) && (
                    <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 bg-gradient-to-t from-white dark:from-slate-900 via-white dark:via-slate-900 to-transparent pointer-events-none z-20">
                      <div className="max-w-4xl mx-auto pointer-events-auto">
                        <button 
                          onClick={handleSend} disabled={isSending || !subject || !body}
                          className="w-full h-16 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[12px] font-black uppercase tracking-widest flex items-center justify-center gap-4 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-2xl active:scale-95 ring-4 ring-slate-900/5 dark:ring-white/5"
                        >
                          {isSending ? "Dispatching..." : <><Send size={20} /> Initiate Thread</>}
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
    </>
  );
};

export default OutreachBuilder;
