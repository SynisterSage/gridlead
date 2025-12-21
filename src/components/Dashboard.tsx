
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

  const chartData = [
    { name: 'Mon', leads: 4 },
    { name: 'Tue', leads: 7 },
    { name: 'Wed', leads: Math.max(5, leads.length - 4) },
    { name: 'Thu', leads: Math.max(8, leads.length - 2) },
    { name: 'Fri', leads: leads.length },
    { name: 'Sat', leads: Math.max(10, leads.length) },
    { name: 'Sun', leads: Math.max(12, leads.length) },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'won': return 'bg-amber-500';
      case 'responded': return 'bg-emerald-500';
      case 'sent': return 'bg-blue-500';
      case 'approved': return 'bg-indigo-500';
      default: return 'bg-slate-300 dark:bg-slate-700';
    }
  };

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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 items-stretch">
          {/* Revenue Progress & Intelligence */}
          <div className="lg:col-span-1 space-y-6 md:space-y-8">
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

            {/* Smart Send Insight */}
            <div className="p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2rem] bg-[#0f172a] dark:bg-slate-900/50 text-white shadow-xl relative overflow-hidden group border-slate-100 dark:border-slate-800">
               <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                  <Sparkles size={120} />
               </div>
               <div className="relative z-10">
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

          {/* Trend Chart */}
          <div className="lg:col-span-2 p-6 md:p-8 border border-slate-100 dark:border-slate-800 rounded-[2.5rem] bg-white dark:bg-slate-900 shadow-sm flex flex-col min-h-[350px] md:min-h-[400px]">
            <div className="flex items-center justify-between mb-8 md:mb-10 px-1">
              <div className="flex items-center gap-2.5">
                <div className="w-1 h-4 md:h-5 bg-slate-200 dark:bg-slate-700 rounded-full" />
                <h3 className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-[#0f172a] dark:text-white">Weekly Volume</h3>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-500">
                <TrendingUp size={10} />
                <span className="text-[8px] md:text-[9px] font-bold uppercase tracking-widest">+12% Gain</span>
              </div>
            </div>
            
            <div className="flex-1 w-full min-h-[250px] relative">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
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
                  <YAxis hide />
                  <Tooltip 
                    cursor={{ stroke: isDark ? '#334155' : '#f1f5f9', strokeWidth: 1 }}
                    contentStyle={{ 
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      borderRadius: '12px', 
                      border: isDark ? '1px solid #1e293b' : '1px solid #f1f5f9', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                      fontSize: '9px', 
                      fontWeight: '800',
                      padding: '8px',
                      color: isDark ? '#f8fafc' : '#0f172a'
                    }}
                    itemStyle={{ color: isDark ? '#38bdf8' : '#0f172a' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="leads" 
                    stroke={isDark ? "#38bdf8" : "#0f172a"} 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#chartGradient)" 
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
