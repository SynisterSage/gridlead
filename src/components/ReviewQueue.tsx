
import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  ExternalLink, 
  Layout, 
  Zap, 
  ShieldCheck, 
  Search, 
  Sparkles, 
  CheckCircle,
  XCircle,
  ArrowRight,
  Info,
  Activity,
  ArrowLeft,
  HelpCircle,
  Loader2,
  Lightbulb
} from 'lucide-react';
import { Lead } from '../types';
import { runAudit } from '../services/audit';
import { fetchLeadBrief, LeadBrief } from '../services/brief';

interface ReviewQueueProps {
  leads: Lead[];
  onUpdateLead: (id: string, updates: Partial<Lead>) => void;
  onDeleteLead: (id: string) => void;
}

const ReviewQueue: React.FC<ReviewQueueProps> = ({ leads, onUpdateLead, onDeleteLead }) => {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvedSuccess, setApprovedSuccess] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [auditStep, setAuditStep] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'detail'>('list');
  const [lastAuditAt, setLastAuditAt] = useState<string | null>(null);
  const [briefs, setBriefs] = useState<Record<string, LeadBrief | null>>({});
  const [briefLoading, setBriefLoading] = useState<Record<string, boolean>>({});
  const [briefError, setBriefError] = useState<Record<string, string | null>>({});

  const activeLeads = leads.filter(l => l.status === 'pending');

  useEffect(() => {
    if (!selectedLead && activeLeads.length > 0) {
      setSelectedLead(activeLeads[0]);
    }
  }, [activeLeads, selectedLead]);

  const loadBrief = React.useCallback((lead?: Lead | null) => {
    const target = lead || selectedLead || activeLeads[0];
    if (!target) return;
    if (briefs[target.id] || briefLoading[target.id]) return;

    setBriefLoading(prev => ({ ...prev, [target.id]: true }));
    setBriefError(prev => ({ ...prev, [target.id]: null }));

    const website = target.website && target.website.toLowerCase().includes('no website')
      ? null
      : target.website;

    fetchLeadBrief({
      id: target.id,
      name: target.name,
      category: target.category,
      rating: target.rating,
      website,
      notes: target.notes || '',
    })
      .then((brief) => {
        setBriefs(prev => ({ ...prev, [target.id]: brief }));
      })
      .catch((err: any) => {
        setBriefError(prev => ({ ...prev, [target.id]: err?.message || 'Failed to load brief' }));
      })
      .finally(() => {
        setBriefLoading(prev => ({ ...prev, [target.id]: false }));
      });
  }, [activeLeads, briefLoading, briefs, selectedLead]);

  useEffect(() => {
    loadBrief();
  }, [loadBrief]);

  const handleApprove = () => {
    if (!selectedLead) return;
    setIsApproving(true);
    
    setTimeout(() => {
      onUpdateLead(selectedLead.id, { status: 'approved' });
      setIsApproving(false);
      setApprovedSuccess(true);
      
      setTimeout(() => {
        setApprovedSuccess(false);
        setSelectedLead(null);
        setMobileView('list');
      }, 1500);
    }, 600);
  };

  const handleDelete = (id: string) => {
    const remaining = activeLeads.filter(l => l.id !== id);
    onDeleteLead(id);
    if (selectedLead?.id === id) {
      setSelectedLead(remaining[0] ?? null);
      setMobileView('list');
    }
  };

  const handleDeepAnalysis = async () => {
    if (!selectedLead || !selectedLead.website || selectedLead.website.toLowerCase().includes('no website')) {
      setAuditStep('No website detected');
      setTimeout(() => setAuditStep(null), 1200);
      console.warn('Deep audit skipped: no website', { leadId: selectedLead?.id, website: selectedLead?.website });
      return;
    }
    setIsAnalyzing(true);
    const timers: number[] = [];
    const scheduleStep = (label: string, delay: number) => {
      const id = window.setTimeout(() => setAuditStep(label), delay);
      timers.push(id);
    };
    setAuditStep('Step 1/4: Fetching site & PageSpeed…');
    scheduleStep('Step 2/4: Rendering page…', 900);
    scheduleStep('Step 3/4: Scoring design & speed…', 1800);
    scheduleStep('Step 4/4: Updating record…', 2600);
    try {
      const audit = await runAudit(`https://${selectedLead.website.replace(/^https?:\/\//, '')}`, selectedLead.id, selectedLead.placeId);
      const updates: Partial<Lead> = {
        score: {
          design: audit.scores.design,
          performance: audit.scores.performance,
          reviews: audit.scores.reviews,
          trust: audit.scores.trust,
        },
        notes: audit.summary,
        checklist: {
          mobileOptimization: audit.checklist.mobileOptimization,
          sslCertificate: audit.checklist.sslCertificate,
          seoPresence: audit.checklist.seoPresence,
          conversionFlow: audit.checklist.conversionFlow,
          hasGoogleReviews: audit.checklist.hasGoogleReviews,
        }
      };
      onUpdateLead(selectedLead.id, updates);
      setSelectedLead(prev => prev && prev.id === selectedLead.id ? { ...prev, ...updates } as Lead : prev);
      setLastAuditAt(new Date().toLocaleString());
      setAuditStep('Done ✓');
      // Refresh brief after audit to include new signals
      loadBrief({ ...(selectedLead as Lead), ...updates });
    } catch (err) {
      console.error('Audit failed', err);
      setAuditStep('Audit failed');
    } finally {
      timers.forEach(id => clearTimeout(id));
      setTimeout(() => setAuditStep(null), 1500);
      setIsAnalyzing(false);
    }
  };

  const getRatingColorClass = (rating: number) => {
    if (rating >= 4.0) return "text-emerald-500";
    if (rating >= 3.0) return "text-slate-400 dark:text-slate-500";
    return "text-rose-500";
  };

  if (activeLeads.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
        <div className="mb-12">
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-3 tracking-tight">Review</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">No leads pending review. Start a discovery job to find more.</p>
        </div>
        <div className="py-20 md:py-32 bg-slate-50/50 dark:bg-slate-900/50 rounded-[2rem] md:rounded-[3rem] border border-dashed border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center space-y-4">
          <Search size={32} className="text-slate-200 dark:text-slate-800" />
          <p className="text-slate-400 dark:text-slate-700 font-bold uppercase tracking-widest text-[9px] md:text-[10px]">Queue Empty</p>
        </div>
      </div>
    );
  }

  const current = selectedLead || activeLeads[0];
  const isAudited = Boolean(
    (current.checklist && Object.values(current.checklist).some(v => v !== undefined)) ||
    (current.notes && current.notes.toLowerCase().includes('performance:'))
  );
  const displayScore = (val: number | undefined) => (isAudited ? (val ?? 0) : 0);

  const currentBrief = current ? briefs[current.id] || null : null;
  const isBriefLoading = current ? briefLoading[current.id] === true : false;
  const briefLoadError = current ? briefError[current.id] || null : null;

  const applyPlaybook = (type: 'review' | 'booking') => {
    if (!current) return;
    const tag = type === 'review' ? '[Playbook: Review SOS]' : '[Playbook: Booking Leak]';
    const alreadyTagged = (current.notes || '').includes(tag);

    const opener = currentBrief?.opener || `Quick wins I spotted for ${current.name}.`;
    const cta = currentBrief?.cta || 'Want me to share a 3-step fix this week?';

    const evidence = currentBrief?.evidence || [];
    const formattedEvidence = evidence.length
      ? `\nEvidence:\n- ${evidence.slice(0, 4).join('\n- ')}`
      : '';

    const subject = type === 'review'
      ? `Lift ${current.name}'s reviews fast`
      : `${current.name} booking quick win`;

    const body = type === 'review'
      ? `${opener}\n\nI can summarize complaints, draft responses, and roll out a 30-day recovery checklist.${formattedEvidence}\n\n${cta}`
      : `${opener}\n\nI can add a clear booking CTA + tracking so you see who’s converting.${formattedEvidence}\n\n${cta}`;

    const nextNotes = alreadyTagged
      ? current.notes
      : `${tag} ${current.notes || ''}`.trim();

    onUpdateLead(current.id, {
      draftSubject: subject,
      draftBody: body,
      notes: nextNotes,
    });
    setSelectedLead(prev => prev && prev.id === current.id ? { ...prev, draftSubject: subject, draftBody: body, notes: nextNotes } as Lead : prev);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Review</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Verify leads and push them to your outreach sequences.</p>
      </div>

      <div className="flex border border-slate-200 dark:border-slate-800 rounded-[2rem] md:rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-950 shadow-xl shadow-slate-200/50 dark:shadow-black/50 min-h-[500px] md:h-[680px] relative ring-1 ring-slate-100/50 dark:ring-slate-800/50">
        
        {/* Success Overlay */}
        {approvedSuccess && (
          <div className="absolute inset-0 z-50 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4 border border-blue-100 dark:border-blue-900/50">
              <CheckCircle size={28} />
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">Lead Approved</h3>
          </div>
        )}

        {/* List Column */}
        <div className={`${mobileView === 'detail' ? 'hidden md:flex' : 'flex'} w-full md:w-80 border-r border-slate-100 dark:border-slate-800 flex-col bg-slate-50/20 dark:bg-slate-900/20 shrink-0`}>
          <div className="p-5 md:p-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950">
            <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Queue ({activeLeads.length})</span>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeLeads.map(lead => (
              <div 
                key={lead.id}
                onClick={() => { setSelectedLead(lead); setMobileView('detail'); }}
                className={`p-5 md:p-6 cursor-pointer border-b border-slate-50 dark:border-slate-800/50 transition-all ${
                  current?.id === lead.id ? 'bg-white dark:bg-slate-900 shadow-sm z-10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/30'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <h3 className="font-bold text-xs md:text-sm truncate text-slate-900 dark:text-white pr-2">{lead.name}</h3>
                  <div className={`text-[10px] md:text-[11px] font-mono font-extrabold ${getRatingColorClass(lead.rating)}`}>
                    {lead.rating.toFixed(1)}
                  </div>
                </div>
                <p className="text-[8px] md:text-[10px] text-slate-400 dark:text-slate-600 uppercase tracking-widest truncate">{lead.category}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Detail Column */}
        <div className={`${mobileView === 'list' ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-white dark:bg-slate-900 overflow-y-auto relative custom-scrollbar`}>
          {current && (
            <div className="p-6 md:p-10 space-y-8 md:space-y-10 animate-in fade-in slide-in-from-right-2 duration-300">
              
              {/* Mobile Back Button */}
              <button onClick={() => setMobileView('list')} className="md:hidden flex items-center gap-2 text-slate-400 font-bold text-[10px] uppercase tracking-widest mb-2">
                <ArrowLeft size={14} /> Back to List
              </button>

              <div className="flex flex-col lg:flex-row justify-between items-start gap-6">
                <div className="flex-1 min-w-0 pr-0 lg:pr-6">
                  <div className="flex items-baseline gap-3 md:gap-4 mb-2">
                    <h2 className="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight truncate shrink">{current.name}</h2>
                    <div className={`text-base md:text-lg font-mono font-extrabold shrink-0 ${getRatingColorClass(current.rating)}`}>
                      {current.rating.toFixed(1)}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 md:gap-4">
                    <a href={`https://${current.website}`} target="_blank" className="text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors flex items-center gap-1.5 text-[10px] md:text-[11px] font-bold underline underline-offset-4 truncate max-w-[200px]">
                      {current.website} <ExternalLink size={10} />
                    </a>
                    <span className="hidden md:block w-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    <span className="text-[9px] md:text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">{current.category}</span>
                  </div>
                </div>
                <div className="flex gap-2 md:gap-3 w-full lg:w-auto">
                  <button 
                    onClick={() => handleDelete(current.id)}
                    className="flex-1 lg:flex-none px-4 md:px-6 h-11 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-500 transition-all"
                  >
                    Discard
                  </button>
                  <button 
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="flex-[2] lg:flex-none px-6 md:px-8 h-11 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] md:text-[11px] font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    {isApproving ? "..." : "Approve"}
                  </button>
                </div>
              </div>

              {/* Score Breakdown */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                {[
                  { label: 'Design', val: displayScore(current.score.design), hint: 'Structure, meta tags, OG/Twitter, headings' },
                  { label: 'Speed', val: displayScore(current.score.performance), hint: 'PageSpeed mobile + probe latency/size' },
                  { label: 'Market', val: displayScore(current.score.reviews), hint: 'Google rating + review volume' },
                  { label: 'Trust', val: displayScore(current.score.trust), hint: 'SSL, contact/social signals, reviews' },
                ].map((stat) => (
                  <div key={stat.label} className="p-3 md:p-4 rounded-xl md:rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/30">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex flex-col relative">
                        <span className="text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-1">
                          {stat.label}
                          <span className="relative group/icon">
                            <HelpCircle size={11} className="text-slate-300 dark:text-slate-700" />
                            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 max-w-[260px] p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all duration-200 text-[10px] font-medium leading-relaxed z-20 whitespace-normal">
                              {!isAudited ? 'Heuristic only — run Deep Audit to populate real scores.' : stat.hint}
                            </div>
                          </span>
                        </span>
                        {!isAudited && <span className="text-[8px] text-amber-500 font-bold uppercase tracking-widest">Heuristic</span>}
                        {isAudited && <span className="text-[8px] text-emerald-500 font-bold uppercase tracking-widest">Audited ✓</span>}
                      </div>
                      <span className="text-[9px] md:text-[10px] font-mono font-bold text-slate-900 dark:text-slate-100">{stat.val}%</span>
                    </div>
                    <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-900 dark:bg-slate-100" style={{ width: `${stat.val}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
                {/* Audit Checklist + Intelligence */}
                <div className="space-y-6 flex flex-col h-full">
                  <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                    <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">Site Audit</h3>
                    <div className="relative group">
                      <button 
                        onClick={handleDeepAnalysis} 
                        className={`text-[8px] md:text-[9px] font-bold uppercase tracking-tight transition-colors disabled:opacity-60 ${isAudited ? 'text-emerald-500' : 'text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300'}`}
                        disabled={isAnalyzing}
                      >
                        {isAudited ? 'Audited ✓' : isAnalyzing ? (auditStep || "Analyzing...") : "Deep Audit"}
                      </button>
                      <div className="absolute bottom-full right-0 mb-3 w-56 p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-[1.25rem] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 ring-1 ring-white/10 dark:ring-white/5">
                        <div className="flex items-center gap-2 mb-2 text-blue-400">
                          <Zap size={12} fill="currentColor" />
                          <span className="text-[9px] font-black uppercase tracking-widest">Tech Intelligence</span>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed opacity-80">
                          Runs PageSpeed, HTML probe, and Google reviews to populate scores.
                        </p>
                        <div className="absolute top-full right-4 -mt-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Mobile Optimization', score: isAudited ? current.checklist?.mobileOptimization === true : false, hint: 'Viewport/mobile friendly markup' },
                      { label: 'SSL Certificate', score: isAudited ? current.checklist?.sslCertificate === true : false, hint: 'HTTPS detected' },
                      { label: 'SEO Presence', score: isAudited ? current.checklist?.seoPresence === true : false, hint: 'Title/description/canonical/structured data' },
                      { label: 'Conversion Flow', score: isAudited ? current.checklist?.conversionFlow === true : false, hint: 'Contact info or CTA present' },
                      { label: 'Page Render (mobile)', score: isAudited ? current.checklist?.hasRender === true : false, hint: 'Rendered HTML captured via Playwright (development/experimental)' },
                      { label: 'Google Reviews', score: isAudited ? current.checklist?.hasGoogleReviews === true : false, hint: 'Places rating/count detected' }
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 relative overflow-visible">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center ${item.score ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-300 dark:text-slate-700'}`}>
                          <CheckCircle size={10} />
                        </div>
                        <p className={`text-[10px] md:text-[11px] font-bold ${item.score ? 'text-slate-900 dark:text-slate-100' : 'text-slate-400 dark:text-slate-600'} flex items-center gap-1`}>
                          {item.label}
                          <span className="relative group/icon">
                            <HelpCircle size={11} className="text-slate-300 dark:text-slate-700" />
                            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 opacity-0 invisible group-hover/icon:opacity-100 group-hover/icon:visible transition-all duration-200 bg-slate-900 dark:bg-slate-800 text-white text-[10px] font-medium rounded-lg px-3 py-2 shadow-2xl w-56 z-30 whitespace-normal">
                              {item.hint}
                            </div>
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                  {/* Intelligence Notes under audit */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-900 dark:text-white">Intelligence Brief</h3>
                        <div className="relative group cursor-help">
                          <HelpCircle size={14} className="text-slate-300 dark:text-slate-700 hover:text-blue-500 transition-colors" />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-56 p-4 bg-slate-900 dark:bg-slate-800 text-white rounded-[1.25rem] shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 transform translate-y-2 group-hover:translate-y-0 z-50 ring-1 ring-white/10">
                            <div className="flex items-center gap-2 mb-2 text-emerald-400">
                              <Sparkles size={12} fill="currentColor" />
                              <span className="text-[9px] font-black uppercase tracking-widest">Personalization Hook</span>
                            </div>
                            <p className="text-[10px] font-medium leading-relaxed opacity-80">
                              Specific weaknesses identified here result in higher conversion rates.
                            </p>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45" />
                          </div>
                        </div>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Tip: run Review SOS / Booking Leak for auto-fill</span>
                    </div>
                    <textarea 
                      value={current.notes || ''}
                      onChange={(e) => onUpdateLead(current.id, { notes: e.target.value })}
                      className="w-full min-h-[140px] bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl md:rounded-2xl p-4 md:p-5 text-[11px] md:text-xs text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-slate-100 transition-all resize-none font-medium leading-relaxed"
                    />
                  </div>
                </div>

                {/* Lead Brief card column */}
                <div className="space-y-4 flex flex-col h-full">
                  <div className="p-4 md:p-5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 flex items-center justify-center shadow-lg">
                          <Lightbulb size={16} />
                        </div>
                        <div>
                          <p className="text-[9px] md:text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Lead Brief</p>
                          <p className="text-[11px] font-extrabold text-slate-900 dark:text-white">{current.name}</p>
                        </div>
                      </div>
                      {isBriefLoading && <Loader2 className="animate-spin text-slate-300 dark:text-slate-700" size={16} />}
                    </div>

                    {briefLoadError && (
                      <div className="text-[11px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-xl p-3">
                        {briefLoadError}
                      </div>
                    )}

                    {!briefLoadError && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {isBriefLoading
                            ? Array.from({ length: 2 }).map((_, idx) => (
                                <span
                                  key={idx}
                                  className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 animate-pulse text-[10px] font-bold text-slate-300 dark:text-slate-600 border border-slate-100 dark:border-slate-800"
                                >
                                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                </span>
                              ))
                            : (currentBrief?.whyNow && currentBrief.whyNow.length ? currentBrief.whyNow : ['Scanning signals...']).map((reason, idx) => (
                                <span 
                                  key={idx} 
                                  className="px-3 py-1 rounded-full bg-slate-900/5 dark:bg-white/5 text-[10px] font-bold text-slate-700 dark:text-slate-200 border border-slate-100 dark:border-slate-800"
                                >
                                  {reason}
                                </span>
                              ))}
                        </div>
                        <div className="border border-slate-100 dark:border-slate-800 rounded-xl p-3 bg-white dark:bg-slate-900/50">
                          <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Talking Points</p>
                          {isBriefLoading ? (
                            <div className="space-y-2">
                              {Array.from({ length: 3 }).map((_, idx) => (
                                <div key={idx} className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <>
                              <ul className="space-y-1.5">
                                {(currentBrief?.talkingPoints && currentBrief.talkingPoints.length
                                  ? currentBrief.talkingPoints
                                  : ['We’ll add a clear CTA and booking path.', 'Tighten speed and trust signals.']
                                ).map((pt, idx) => (
                                  <li key={idx} className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-start gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1" /> {pt}
                                  </li>
                                ))}
                              </ul>
                              {currentBrief?.complaints && currentBrief.complaints.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Complaints</p>
                                  <ul className="space-y-1">
                                    {currentBrief.complaints.map((ev, idx) => (
                                      <li key={idx} className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1" /> {ev}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                              {currentBrief?.evidence && currentBrief.evidence.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">Evidence</p>
                                  <ul className="space-y-1">
                                    {currentBrief.evidence.map((ev, idx) => (
                                      <li key={idx} className="text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-start gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-1" /> {ev}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>

              {/* Opener + CTA + Playbooks full width */}
              <div className="border border-slate-100 dark:border-slate-800 rounded-2xl p-4 md:p-5 bg-slate-50 dark:bg-slate-950 space-y-3 mt-6 lg:col-span-2">
                <div className="flex items-center gap-2">
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Suggested opener</p>
                </div>
                {isBriefLoading ? (
                  <div className="space-y-2">
                    <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse" />
                    <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-3/4" />
                    <div className="h-3 rounded bg-slate-100 dark:bg-slate-800 animate-pulse w-1/2" />
                  </div>
                ) : (
                  <>
                    <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100 leading-relaxed">
                      {currentBrief?.opener || 'Spotted quick wins—happy to share a 3-step fix this week.'}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">CTA</p>
                    <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                      {currentBrief?.cta || 'Want me to prioritize the fixes and send a quick plan?'}
                    </p>
                  </>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    onClick={() => applyPlaybook('review')}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-sm"
                  >
                    <Sparkles size={14} /> Review SOS
                  </button>
                  <button
                    onClick={() => applyPlaybook('booking')}
                    className="flex items-center justify-center gap-2 px-3 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                  >
                    <Layout size={14} /> Booking Leak
                  </button>
                </div>
                {currentBrief && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {[
                      { label: 'SSL', ok: currentBrief.signals.hasSSL },
                      { label: 'Booking', ok: currentBrief.signals.hasBooking },
                      { label: 'Form', ok: currentBrief.signals.hasForm },
                      { label: 'Pixel', ok: currentBrief.signals.hasPixel },
                      { label: 'Schema', ok: currentBrief.signals.hasSchema },
                      { label: 'Contact', ok: currentBrief.signals.hasContact },
                    ].map((sig) => (
                      <span
                        key={sig.label}
                        className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                          sig.ok
                            ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/50'
                            : 'bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800'
                        }`}
                      >
                        {sig.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewQueue;
