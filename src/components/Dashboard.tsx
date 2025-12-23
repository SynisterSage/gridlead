import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  Mail, 
  DollarSign, 
  Clock, 
  Zap, 
  TrendingUp, 
  Edit2, 
  Check, 
  Calendar, 
  Sparkles 
} from 'lucide-react';
import { Lead, AppView, Profile } from '../types';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '../ThemeContext';
import { supabase } from '../lib/supabaseClient';

interface DashboardProps {
  leads: Lead[];
  onNavigate: (view: AppView) => void;
  profile?: Profile | null;
  onSaveGoal?: (goal: number) => Promise<{ error?: string | null } | void>;
}

const Dashboard: React.FC<DashboardProps> = ({ leads, onNavigate, profile, onSaveGoal }) => {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const sentCount = leads.filter(l => ['sent', 'responded', 'won'].includes(l.status)).length;
  const reviewCount = leads.filter(l => l.status === 'approved').length;
  const winCount = leads.filter(l => l.status === 'won').length;

  const [monthlyGoal, setMonthlyGoal] = useState(profile?.monthly_goal ?? 10000);
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState((profile?.monthly_goal ?? 10000).toString());
  const [goalSaving, setGoalSaving] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  
  React.useEffect(() => {
    if (profile?.monthly_goal) {
      setMonthlyGoal(profile.monthly_goal);
      setTempGoal(profile.monthly_goal.toString());
    }
  }, [profile?.monthly_goal]);
  
  const avgDealSize = 2500;
  const currentRevenue = winCount * avgDealSize;
  const pipelineValue = sentCount * avgDealSize;
  const goalProgress = Math.min(100, (currentRevenue / monthlyGoal) * 100);
  const [primaryGmail, setPrimaryGmail] = useState<string | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);

  React.useEffect(() => {
    const loadPrimaryGmail = async () => {
      setGmailLoading(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setPrimaryGmail(null);
        setGmailLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('gmail_accounts')
        .select('email, is_primary')
        .eq('user_id', userId)
        .eq('is_primary', true)
        .maybeSingle();
      if (!error && data?.email) {
        setPrimaryGmail(data.email);
      } else {
        setPrimaryGmail(null);
      }
      setGmailLoading(false);
    };
    void loadPrimaryGmail();
  }, []);

  const handleSaveGoal = async () => {
    const val = parseInt(tempGoal);
    if (isNaN(val) || val <= 0) {
      setGoalError('Enter a valid goal.');
      return;
    }
    setGoalError(null);
    setGoalSaving(true);
    try {
      if (onSaveGoal) {
        const result = await onSaveGoal(val);
        if (result && result.error) {
          setGoalError(result.error);
          return;
        }
      }
      setMonthlyGoal(val);
      setIsEditingGoal(false);
    } finally {
      setGoalSaving(false);
    }
  };

  type MetricOption = 'volume' | 'pipeline' | 'responses';
  type RangeOption = '1' | '7';

  const metricOptions: Array<{ id: MetricOption; label: string }> = [
    { id: 'volume', label: 'Outreach Volume' },
    { id: 'pipeline', label: 'Pipeline Value' },
    { id: 'responses', label: 'Responses' },
  ];

  const rangeOptions: Array<{ id: RangeOption; label: string }> = [
    { id: '1', label: 'Last 1d' },
    { id: '7', label: 'Last 7d' },
  ];

  const [selectedMetric, setSelectedMetric] = useState<MetricOption>(metricOptions[0].id);
  const [selectedRange, setSelectedRange] = useState<RangeOption>(rangeOptions[1].id);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return 'bg-amber-500';
      case 'responded': return 'bg-emerald-500';
      case 'sent': return 'bg-blue-500';
      case 'approved': return 'bg-indigo-500';
      default: return 'bg-slate-300 dark:bg-slate-700';
    }
  };

  const chartData = React.useMemo(() => {
    const dayKey = (d: Date) => {
      const year = d.getFullYear();
      const month = `${d.getMonth() + 1}`.padStart(2, '0');
      const day = `${d.getDate()}`.padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const days = parseInt(selectedRange, 10) || 7;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(today);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));

    const prevStart = new Date(start);
    prevStart.setDate(prevStart.getDate() - days);
    const prevEnd = new Date(start);
    prevEnd.setDate(prevEnd.getDate() - 1);

    const buckets = Array.from({ length: days }).map((_, idx) => {
      const d = new Date(start);
      d.setDate(start.getDate() + idx);
      const label = days === 1 ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' });
      return { date: d, key: dayKey(d), label, value: 0 };
    });

    const bucketMap = new Map(buckets.map(b => [b.key, b]));

    const getMetricValue = (lead: Lead) => {
      const status = (lead.status || '').toLowerCase();
      if (selectedMetric === 'volume') {
        return ['sent', 'responded', 'won'].includes(status) ? 1 : 0;
      }
      if (selectedMetric === 'pipeline') {
        return ['sent', 'responded', 'won'].includes(status) ? avgDealSize : 0;
      }
      if (selectedMetric === 'responses') {
        return ['responded', 'won'].includes(status) ? 1 : 0;
      }
      return 0;
    };

    let currentTotal = 0;
    let previousTotal = 0;
    let maxValue = 0;

    leads.forEach(lead => {
      const timestamp = lead.sentAt ?? lead.updatedAt ?? lead.createdAt ?? Date.now();
      if (!timestamp) return;
      const tsDate = new Date(timestamp);
      tsDate.setHours(0, 0, 0, 0);

      const value = getMetricValue(lead);
      if (value === 0) return;

      if (tsDate >= start && tsDate <= today) {
        const key = dayKey(tsDate);
        const bucket = bucketMap.get(key);
        if (bucket) {
          bucket.value += value;
          currentTotal += value;
          if (bucket.value > maxValue) maxValue = bucket.value;
        }
      } else if (tsDate >= prevStart && tsDate <= prevEnd) {
        previousTotal += value;
      }
    });

    const gain = previousTotal === 0 ? (currentTotal > 0 ? 100 : 0) : ((currentTotal - previousTotal) / previousTotal) * 100;

    return {
      series: buckets.map(b => ({ name: b.label, leads: b.value })),
      currentTotal,
      previousTotal,
      gain,
      maxValue,
    };
  }, [leads, selectedMetric, selectedRange, avgDealSize]);

  const formatMetricValue = (value: number, metric: MetricOption) => {
    if (metric === 'pipeline') {
      return `$${Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
    }
    return value.toLocaleString();
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const val = payload[0].value ?? 0;
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 shadow-xl text-xs font-bold text-slate-100">
        <p className="mb-1">{label}</p>
        <p className="text-[#38bdf8]">
          {metricOptions.find(m => m.id === selectedMetric)?.label}: {formatMetricValue(val, selectedMetric)}
        </p>
      </div>
    );
  };

  const chartColor = React.useMemo(() => {
    switch (selectedMetric) {
      case 'pipeline': return '#34d399';
      case 'responses': return '#c084fc';
      default: return '#38bdf8';
    }
  }, [selectedMetric]);

  const yMax = chartData.maxValue === 0 ? 1 : Math.ceil(chartData.maxValue * 1.25);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-[#0f172a] dark:text-white mb-2 tracking-tight">Stats</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Performance metrics for your growth engine.</p>
      </div>

      <div className="space-y-8 md:space-y-12">
        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: 'Pipeline Val.', val: `$${pipelineValue.toLocaleString()}`, icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-50/50 dark:bg-emerald-900/20' },
            { label: 'Reviewing', val: reviewCount.toString(), icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50/50 dark:bg-indigo-900/20' },
            { label: 'Total Outreach', val: sentCount.toString(), icon: Mail, color: 'text-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-900/20' },
            { label: 'Close Rate', val: sentCount > 0 ? `${Math.round((winCount / sentCount) * 100)}%` : '0%', icon: Zap, color: 'text-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-900/20' },
          ].map(stat => (
            <div key={stat.label} className="p-5 md:p-7 border border-slate-100 dark:border-slate-800 rounded-[1.5rem] md:rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-sm flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-lg transition-all">
              <div className="flex items-center justify-between mb-4 md:mb-6">
                <div className={`p-1.5 md:p-2 rounded-lg md:rounded-xl ${stat.bg}`}>
                  <stat.icon size={14} className={`${stat.color} md:w-4 md:h-4`} />
                </div>
                <ArrowUpRight size={10} className="text-slate-300 dark:text-slate-600" />
              </div>
              <div>
                <p className="text-xl md:text-3xl font-extrabold text-[#0f172a] dark:text-white tracking-tighter">{stat.val}</p>
                <p className="text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-6 items-start">
          <div className="space-y-6">
            <div className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2rem] bg-white dark:bg-slate-900 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-[9px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-white">Revenue Target</h3>
                <button 
                  onClick={() => setIsEditingGoal(!isEditingGoal)} 
                  className="p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  {isEditingGoal ? <Check size={14} onClick={handleSaveGoal} /> : <Edit2 size={12} />}
                </button>
              </div>
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-slate-900 dark:text-white">${currentRevenue.toLocaleString()}</span>
                  <span className="text-slate-300 dark:text-slate-700 font-bold text-[10px] uppercase">/</span>
                  {isEditingGoal ? (
                    <input 
                      autoFocus
                      type="number" 
                      value={tempGoal} 
                      onChange={(e) => setTempGoal(e.target.value)}
                      onBlur={() => { if (!goalSaving) void handleSaveGoal(); }}
                      onKeyDown={(e) => e.key === 'Enter' && void handleSaveGoal()}
                      className="w-24 bg-slate-50 dark:bg-slate-800 border-none p-0 text-xl font-black text-slate-400 focus:outline-none"
                    />
                  ) : (
                    <span className="text-xl font-black text-slate-300 dark:text-slate-700">${monthlyGoal.toLocaleString()}</span>
                  )}
                </div>
                <div className="h-4 w-full bg-slate-50 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-100 dark:border-slate-700 p-0.5 shadow-inner">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-out" style={{ width: `${goalProgress}%` }} />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{goalProgress.toFixed(0)}% Achieved</span>
                </div>
                {goalError && <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{goalError}</p>}
              </div>
            </div>

            <div className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2rem] bg-[#0f172a] dark:bg-slate-900/50 text-white shadow-xl relative overflow-hidden group min-h-[400px] flex flex-col">
              <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                <Sparkles size={120} />
              </div>
              <div className="relative z-10 flex-1 flex flex-col">
                <div>
                  <div className="flex items-center gap-2 mb-6">
                    <Calendar size={14} className="text-emerald-400" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Dispatch Insight</span>
                  </div>
                  <h4 className="text-xl font-black mb-1">Best Time to Send</h4>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-6">Based on niche open rates</p>
                  
                  <div className="flex items-center gap-4">
                    <div className="px-4 py-2 bg-white/10 dark:bg-slate-800 rounded-xl border border-white/10 dark:border-slate-700">
                      <span className="text-xl font-black">9:30 AM</span>
                      <p className="text-[8px] font-bold text-emerald-400 uppercase mt-0.5">EST • Tuesdays</p>
                    </div>
                    <ArrowUpRight size={16} className="text-emerald-400" />
                  </div>
                </div>
                <div className="mt-6 border-t border-white/10 pt-4 text-[10px] text-slate-200 flex flex-wrap gap-3">
                  <span className="flex items-center gap-2 uppercase tracking-widest font-bold">
                    <span className="w-1 h-1 rounded-full bg-emerald-400" /> Avg open 48%
                  </span>
                  <span className="flex items-center gap-2 uppercase tracking-widest font-bold">
                    <span className="w-1 h-1 rounded-full bg-slate-300" /> Avg reply 12%
                  </span>
                  <span className="flex items-center gap-2 uppercase tracking-widest font-bold">
                    <span className="w-1 h-1 rounded-full bg-slate-500" /> Next touch: 9am
                  </span>
                </div>
                <div className="mt-auto pt-5 border-t border-white/5 flex items-center justify-between text-[9px] uppercase tracking-widest font-bold text-slate-300">
                  <span className="text-[8px] text-slate-400">Based on last 30 days</span>
                  <button className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-[9px] font-black hover:bg-white/15 transition-colors">
                    Refine schedule
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <button
              type="button"
              onClick={() => {
                localStorage.setItem('gridlead_settings_tab', 'integrations');
                onNavigate(AppView.SETTINGS);
              }}
              className="w-full text-left"
            >
              <div className="p-5 md:p-6 border border-slate-100 dark:border-slate-800 rounded-[2rem] bg-slate-900/80 dark:bg-slate-900 shadow-sm hover:border-slate-300/70 dark:hover:border-slate-700 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-[9px] font-bold uppercase tracking-widest text-slate-200">Primary Gmail</h3>
                  <span className="text-[7px] uppercase tracking-[0.3em] text-slate-500">{gmailLoading ? 'Loading' : (primaryGmail ? 'Connected' : 'Not set')}</span>
                </div>
                <p className="text-sm font-bold text-white truncate">
                  {primaryGmail || 'No primary Gmail connected'}
                </p>
                <p className="text-[9px] text-slate-400 mt-1">
                  {primaryGmail
                    ? 'Used to send outreach and track replies.'
                    : 'Tap to connect in Settings → Integrations.'}
                </p>
              </div>
            </button>

            <div className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-[360px]">
              <div className="flex items-center justify-between mb-4 md:mb-6 px-1">
                <div className="flex items-center gap-2.5">
                  <div className="w-1 h-4 md:h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                  <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-white">Weekly Volume</h3>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1.5 text-emerald-500">
                    <TrendingUp size={10} />
                    <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest">
                      {chartData.gain >= 0 ? '+' : ''}
                      {Number.isFinite(chartData.gain) ? chartData.gain.toFixed(0) : '0'}% Gain
                    </span>
                  </div>
                  <span className="text-[8px] md:text-[9px] uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Showing {rangeOptions.find(r => r.id === selectedRange)?.label.toLowerCase()}
                  </span>
                </div>
              </div>
              <div className="flex flex-col md:flex-row gap-3 md:items-center mb-4">
                <div className="flex items-center gap-2 bg-slate-900/50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Metric</label>
                  <select
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value as MetricOption)}
                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none text-slate-100 focus:outline-none"
                  >
                    {metricOptions.map(metric => (
                      <option key={metric.id} value={metric.id}>{metric.label}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-slate-900/50 dark:bg-slate-900 rounded-xl px-3 py-2 border border-slate-200 dark:border-slate-800">
                  <label className="text-[9px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Range</label>
                  <select
                    value={selectedRange}
                    onChange={(e) => setSelectedRange(e.target.value as RangeOption)}
                    className="text-[10px] font-bold uppercase tracking-widest bg-transparent border-none text-slate-100 focus:outline-none"
                  >
                    {rangeOptions.map(range => (
                      <option key={range.id} value={range.id}>{range.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="w-full h-[260px] md:h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData.series} margin={{ top: 5, right: 12, left: 12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={isDark ? "#38bdf8" : "#0f172a"} stopOpacity={0.08}/>
                        <stop offset="95%" stopColor={isDark ? "#38bdf8" : "#0f172a"} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#1e293b" : "#f1f5f9"} opacity={0.5} />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 8, fontWeight: 700, fill: isDark ? '#475569' : '#cbd5e1' }}
                      dy={10}
                    />
                    <YAxis 
                      domain={[0, yMax]} 
                      axisLine={false} 
                      tickLine={false}
                      tickFormatter={(val) => formatMetricValue(val, selectedMetric)}
                      tick={{ fontSize: 9, fontWeight: 800, fill: isDark ? '#475569' : '#94a3b8' }}
                      width={60}
                      tickMargin={8}
                    />
                    <Tooltip 
                      cursor={{ stroke: isDark ? '#334155' : '#f1f5f9', strokeWidth: 1 }}
                      content={renderTooltip}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="leads" 
                      stroke={chartColor} 
                      strokeWidth={2.5} 
                      fillOpacity={1} 
                      fill="url(#chartGradient)" 
                      isAnimationActive
                      animationDuration={800}
                      animationEasing="ease-in-out"
                      dot={{ r: 4, strokeWidth: 2, stroke: chartColor, fill: isDark ? '#0f172a' : '#ffffff' }}
                      activeDot={{ r: 7, fill: chartColor, stroke: isDark ? '#0f172a' : '#ffffff', strokeWidth: 2.5 }}
                      connectNulls
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2rem] bg-white dark:bg-slate-900 shadow-sm flex flex-col">
          <div className="flex items-center gap-2.5 mb-6 md:mb-8">
            <div className="w-1 h-4 md:h-5 bg-[#0f172a] dark:bg-white rounded-full" />
            <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-white">Live Activity</h3>
          </div>
          <div className="space-y-4 md:space-y-6 flex-1">
            {leads.length > 0 ? (
              leads.slice(0, 5).map((lead, idx) => (
                <div key={lead.id} className="flex items-start gap-3 md:gap-4">
                  <div className="relative mt-1">
                    <div className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${getStatusColor(lead.status)} ring-4 ring-white dark:ring-slate-900 relative z-10`} />
                    {idx < leads.slice(0, 5).length - 1 && (
                      <div className="absolute top-3 left-1/2 -translate-x-1/2 w-px h-10 bg-slate-100 dark:bg-slate-800" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <p className="text-[10px] md:text-[11px] text-[#0f172a] dark:text-white font-bold truncate">{lead.name}</p>
                      <span className="text-[7px] md:text-[8px] font-mono font-bold text-slate-300 dark:text-slate-700 uppercase shrink-0">{lead.lastScan}</span>
                    </div>
                    <p className="text-[8px] md:text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight mt-0.5">{lead.status.replace('_', ' ')}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full py-10 flex flex-col items-center justify-center text-center opacity-10">
                <Clock size={32} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
