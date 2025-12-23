
import React, { useState, useRef, useEffect } from 'react';
import { Search, Send, BarChart3, ArrowRight, CheckCircle2, Globe, Shield, Activity, Users, Star, Layout, MousePointer2, Sparkles, Server, Cpu, Globe2, Menu, X, Rocket, Briefcase, Eye, ShieldCheck, Gauge, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

type MarketingPage = 'home' | 'platform' | 'pricing';

const useReveal = (deps: React.DependencyList = []) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fallback = window.setTimeout(() => setVisible(true), 800);
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
            window.clearTimeout(fallback);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  // include deps so this re-evaluates when referenced content mounts (e.g., tab changes)
  }, deps);

  return { ref, visible };
};

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [activePage, setActivePage] = useState<MarketingPage>('home');
  const [heroVisible, setHeroVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoQuery, setDemoQuery] = useState('');
  const [isDemoScanning, setIsDemoScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{name: string, score: number, issues: string[]} | null>(null);
  const { theme, toggleTheme } = useTheme();
  
  const featureSectionRef = useRef<HTMLDivElement>(null);
  const scoreLeftReveal = useReveal();
  const scoreCardReveal = useReveal();
  const platformIntroReveal = useReveal([activePage]);
  const platformGridReveal = useReveal([activePage]);
  const platformCtaReveal = useReveal([activePage]);
  const pricingIntroReveal = useReveal([activePage]);
  const pricingGridReveal = useReveal([activePage]);
  const agencyAvatars = [
    { initials: 'SN', name: 'Studio North', gradient: 'from-sky-500 to-blue-600' },
    { initials: 'LA', name: 'Loop Atelier', gradient: 'from-indigo-500 to-purple-500' },
    { initials: 'MT', name: 'Midnight Tech', gradient: 'from-emerald-500 to-teal-500' },
    { initials: 'GD', name: 'Gridline Digital', gradient: 'from-amber-500 to-orange-500' },
  ];
  const platformPillars = [
    { title: 'Signal Mining', icon: Search, pill: 'Prospect Graph', desc: 'Scrapes and enriches sites with stack signals, local SEO cues, and social proof to find gaps worth pitching.' },
    { title: 'AI Audits', icon: Sparkles, pill: 'Perf + UX', desc: 'Runs performance and UX heuristics to score page speed, layout debt, and mobile readiness in one sweep.' },
    { title: 'Outreach Studio', icon: Send, pill: 'Personalized', desc: 'Drafts context-rich openers tied to their gaps, with rotation-safe sending and reply tracking baked in.' },
    { title: 'Inbox Health', icon: Shield, pill: 'Deliverability', desc: 'Rotates accounts, watches sender reputation, and alerts you before threads stall or bounce.' },
    { title: 'Pipeline Ops', icon: MousePointer2, pill: 'Workflow', desc: 'Queues, snoozes, and routes leads so your team can work the next best action without spreadsheets.' },
    { title: 'Proof Layer', icon: Gauge, pill: 'Evidence', desc: 'Auto-includes benchmarks and lightweight audits so every send carries a “why you” argument.' },
  ];

  useEffect(() => {
    // Delay ensures CSS transition has time to apply before toggling visibility.
    const id = requestAnimationFrame(() => setHeroVisible(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const handleDemoSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoQuery) return;
    setIsDemoScanning(true);
    setScanResult(null);

    // Simulate scanning
    setTimeout(() => {
      setIsDemoScanning(false);
      setScanResult({
        name: demoQuery.includes(' ') ? demoQuery : `${demoQuery} Local`,
        score: Math.floor(Math.random() * 30) + 20,
        issues: ['Missing SSL', 'No Mobile View', 'LCP > 4.5s']
      });
      featureSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 1800);
  };

  const Nav = () => (
    <nav className="relative z-30 px-6 md:px-10 py-6 md:py-8 flex items-center justify-between max-w-7xl mx-auto w-full">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setActivePage('home'); setMobileMenuOpen(false); }}>
        <div className="w-9 h-9 md:w-10 md:h-10 bg-slate-900 dark:bg-slate-100 rounded-xl flex items-center justify-center shadow-lg ring-1 ring-slate-800/20 dark:ring-white/20">
          <img
            src={theme === 'dark' ? '/icon-dark.svg' : '/icon.svg'}
            alt="GridLead logo"
            className="w-6 h-6 object-contain"
          />
        </div>
        <span className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white tracking-tight text-nowrap">GridLead</span>
      </div>
      
      <div className="hidden md:flex items-center gap-10">
        <div className="flex items-center gap-8">
            {[
              { id: 'platform', label: 'Platform' },
              { id: 'pricing', label: 'Pricing' }
            ].map(item => (
              <button 
                key={item.id} 
                onClick={() => setActivePage(item.id as MarketingPage)}
                className={`text-[10px] font-bold uppercase tracking-widest transition-colors ${activePage === item.id ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button 
            onClick={toggleTheme}
            className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            aria-label="Toggle Theme"
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

        <button 
          onClick={onGetStarted}
          className="px-6 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-200 transition-all shadow-xl"
        >
          Start Growth
        </button>
      </div>

      <button className="md:hidden p-2 text-slate-900 dark:text-white" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {mobileMenuOpen && (
        <div className="fixed inset-0 top-[72px] bg-white dark:bg-slate-950 z-40 p-10 flex flex-col gap-8 animate-in fade-in slide-in-from-top-4 duration-300 md:hidden">
            {['platform', 'pricing'].map(id => (
              <button 
                key={id}
                onClick={() => { setActivePage(id as MarketingPage); setMobileMenuOpen(false); }}
                className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight text-left capitalize"
              >
                {id}
              </button>
            ))}
          <a 
            href="/privacy.html" 
            className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight"
            onClick={() => setMobileMenuOpen(false)}
          >
            Privacy
          </a>
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Theme</span>
            <button onClick={toggleTheme} className="text-slate-900 dark:text-white">
              {theme === 'light' ? <Moon size={24} /> : <Sun size={24} />}
            </button>
          </div>
          <button 
            onClick={onGetStarted}
            className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-sm font-bold uppercase tracking-widest mt-4"
          >
            Start Growth
          </button>
        </div>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05] bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:24px_24px] z-0" />
      <Nav />
      
      {activePage === 'home' && (
        <div className="flex flex-col">
          <main className={`relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto pt-16 md:pt-24 pb-20 transition-all duration-700 ease-out ${heroVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.99]'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Built for web dev agencies</span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold text-slate-900 dark:text-white tracking-tighter leading-[0.9] mb-8">
              Your solo outreach <br /><span className="text-slate-300 dark:text-slate-700">automated.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl mb-12">
              GridLead finds sites with design or performance gaps, scores intent, and drafts outreach, so your shop spends more time shipping.
            </p>

            <form onSubmit={handleDemoSearch} className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-2 md:p-3 rounded-2xl md:rounded-[2rem] shadow-2xl mb-12 flex flex-col sm:flex-row gap-2">
              <input 
                type="text" 
                placeholder="Try: 'Bakeries in Austin'..." 
                value={demoQuery}
                onChange={(e) => setDemoQuery(e.target.value)}
                className="flex-1 px-6 py-4 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              />
              <button 
                type="submit"
                disabled={isDemoScanning}
                className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl md:rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-slate-200 transition-all whitespace-nowrap active:scale-95"
              >
                {isDemoScanning ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Rocket size={16} /> Scan Market</>}
              </button>
            </form>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="flex -space-x-3">
                {agencyAvatars.map(({ initials, name, gradient }) => (
                  <div
                    key={name}
                    title={name}
                    className={`w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 bg-gradient-to-br ${gradient} flex items-center justify-center text-[10px] font-black text-white shadow-lg shadow-slate-900/10 dark:shadow-black/30`}
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Growing web teams daily</p>
            </div>
          </main>

          <section ref={featureSectionRef} className="bg-slate-50 dark:bg-slate-900/50 py-24 md:py-32 px-6 border-y border-slate-100 dark:border-slate-800">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div
                ref={scoreLeftReveal.ref}
                className={`transition-all duration-700 ease-out ${scoreLeftReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
              >
                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-900 dark:text-white mb-8">
                  <Briefcase size={20} />
                </div>
                <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-6 tracking-tight">Lead Scoring that <br /><span className="text-slate-300 dark:text-slate-700">Actually Works.</span></h2>
                <p className="text-lg text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8">Stop emailing dead sites. GridLead uses AI to analyze design gaps, performance deficits, and SEO health before you hit send.</p>
                <div className="space-y-4">
                  {['Tech Stack Deficit Detection', 'Local SEO Opportunity Score', 'Conversion Rate Audit AI'].map((feat, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-5 h-5 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 size={12} />
                      </div>
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div
                ref={scoreCardReveal.ref}
                className={`bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden min-h-[400px] transition-all duration-700 ease-out ${scoreCardReveal.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-10 scale-[0.98]'} delay-100`}
              >
                <div className="absolute inset-0 pointer-events-none opacity-5 dark:opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] dark:bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px]" />
                
                {scanResult ? (
                  <div className="relative animate-in fade-in zoom-in-95 duration-500 space-y-8">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-1">Live Audit Result</p>
                        <h4 className="text-2xl font-black text-slate-900 dark:text-white">{scanResult.name}</h4>
                      </div>
                      <div className="w-14 h-14 bg-rose-50 dark:bg-rose-900/20 rounded-2xl border border-rose-100 dark:border-rose-900/50 flex items-center justify-center text-rose-500 font-mono font-black text-lg">
                        {scanResult.score}%
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2 text-emerald-600 dark:text-emerald-400">
                          <ShieldCheck size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Trust</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Valid SSL</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2 text-rose-500 dark:text-rose-400">
                          <Gauge size={14} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Perf</span>
                        </div>
                        <p className="text-xs font-bold text-slate-900 dark:text-white">Slow LCP</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                       <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Critical Weaknesses</p>
                       <div className="flex flex-wrap gap-2">
                          {scanResult.issues.map((issue, i) => (
                            <span key={i} className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 rounded-lg text-[9px] font-black uppercase tracking-tight border border-rose-100 dark:border-rose-900/50">
                              {issue}
                            </span>
                          ))}
                       </div>
                    </div>

                    <button onClick={onGetStarted} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10">
                       Engage This Lead <Send size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-12 min-h-[400px] w-full">
                     <div className={`w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex items-center justify-center text-slate-200 dark:text-slate-700 mb-6 ${isDemoScanning ? 'animate-pulse' : ''}`}>
                        <Activity size={32} />
                     </div>
                     <p className="text-sm font-bold text-slate-400 dark:text-slate-600 max-w-[200px]">
                        {isDemoScanning ? "Analyzing market deficits..." : "Enter a search above to see our lead scoring engine in action."}
                     </p>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      )}

      {activePage === 'platform' && (
        <main className="relative z-10 flex-1 px-6 md:px-10 py-12 md:py-16 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div
            ref={platformIntroReveal.ref}
            className={`text-center mb-20 md:mb-28 transition-all duration-700 ease-out ${platformIntroReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-sky-500 rounded-full" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Platform</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6 md:mb-7 leading-tight">
              Built for web dev teams <br /><span className="text-slate-300 dark:text-slate-700">to ship more closes.</span>
            </h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed text-sm md:text-lg">
              A single system for finding, scoring, and pitching leads with proof—without duct-taped spreadsheets or cold spam.
            </p>
          </div>

          <div
            ref={platformGridReveal.ref}
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-7 mb-24 md:mb-32 transition-all duration-700 ease-out ${platformGridReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {platformPillars.map((item, i) => (
              <div
                key={item.title}
                style={{ transitionDelay: platformGridReveal.visible ? `${i * 60}ms` : '0ms' }}
                className="group relative p-8 md:p-9 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] md:rounded-[2.75rem] shadow-sm overflow-hidden transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-200 dark:hover:border-slate-700"
              >
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                  <div className="absolute -top-12 -right-12 w-32 h-32 bg-sky-500/10 blur-3xl" />
                  <div className="absolute -bottom-12 -left-6 w-28 h-28 bg-emerald-400/10 blur-3xl" />
                </div>
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-11 h-11 md:w-12 md:h-12 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-100 dark:ring-slate-700">
                    <item.icon size={22} />
                  </div>
                  <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 rounded-full">
                    {item.pill}
                  </span>
                </div>
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white mb-3">{item.title}</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            ref={platformCtaReveal.ref}
            className={`p-10 md:p-16 bg-slate-900 dark:bg-slate-900/60 rounded-[3rem] md:rounded-[5rem] text-center text-white relative shadow-2xl overflow-hidden border border-slate-100/5 dark:border-slate-800 transition-all duration-700 ease-out ${platformCtaReveal.visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.99]'}`}
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,#38bdf8_0,transparent_35%),radial-gradient(circle_at_80%_0%,#22d3ee_0,transparent_30%),radial-gradient(circle_at_50%_90%,#0f172a_0,transparent_40%)] opacity-30" />
            <h3 className="text-3xl md:text-5xl font-extrabold mb-6 relative z-10 leading-[0.95]">
              Ready to land <br /><span className="text-slate-500">design + build retainers?</span>
            </h3>
            <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-8 relative z-10">
              <div className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" /> 92% reply-safe warmups
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 bg-sky-400 rounded-full" /> Proof-first outreach
              </div>
            </div>
            <button onClick={onGetStarted} className="relative z-10 px-10 py-4 bg-white text-slate-900 rounded-xl text-[10px] md:text-[11px] font-bold uppercase tracking-widest active:scale-95 shadow-lg shadow-black/10">
              Get Started Now
            </button>
          </div>
        </main>
      )}

      {activePage === 'pricing' && (
        <main className="relative z-10 flex-1 px-6 md:px-10 py-12 md:py-20 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div
            ref={pricingIntroReveal.ref}
            className={`text-center mb-16 transition-all duration-700 ease-out ${pricingIntroReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-full mb-6">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Pricing</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Pick your pace.</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base max-w-2xl mx-auto">Start free. Upgrade when you want more sends, deeper audits, and team collaboration.</p>
          </div>

          <div
            ref={pricingGridReveal.ref}
            className={`grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 transition-all duration-700 ease-out ${pricingGridReveal.visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            <div
              className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-200 dark:hover:border-slate-700 relative overflow-hidden"
              style={{ transitionDelay: pricingGridReveal.visible ? '40ms' : '0ms' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute -top-12 -right-12 w-28 h-28 bg-sky-500/14 blur-3xl" />
                <div className="absolute -bottom-10 -left-8 w-24 h-24 bg-emerald-400/14 blur-3xl" />
              </div>
              <div className="mb-8">
                <h3 className="text-base md:text-lg font-extrabold text-slate-900 dark:text-white mb-1 md:mb-2">Starter</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">$0</span>
                  <span className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-widest">/mo</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-2">Kick the tires with real leads.</p>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['50 leads / mo', '2 sender seats', 'Light audits (perf + SSL)', 'Email templates + replies', 'Community support'].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-4 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Start Free</button>
            </div>

            <div
              className="group bg-slate-900 dark:bg-slate-100 p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] text-white dark:text-slate-900 flex flex-col relative overflow-hidden shadow-2xl border border-slate-800/60 dark:border-slate-200/60 transition-all duration-500 hover:-translate-y-1 hover:shadow-[0_25px_60px_-25px_rgba(0,0,0,0.45)]"
              style={{ transitionDelay: pricingGridReveal.visible ? '120ms' : '0ms' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute -top-14 -right-10 w-32 h-32 bg-sky-500/18 blur-3xl" />
                <div className="absolute -bottom-12 -left-8 w-28 h-28 bg-emerald-400/18 blur-3xl" />
              </div>
              <div className="absolute top-6 right-6 bg-emerald-500 text-white text-[7px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Best Value</div>
              <div className="mb-8">
                <h3 className="text-base md:text-lg font-extrabold mb-1 md:mb-2">Studio</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-extrabold">$25</span>
                  <span className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-widest">/mo</span>
                </div>
                <p className="text-slate-300 dark:text-slate-600 text-xs md:text-sm mt-2">Built for web shops growing pipeline.</p>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['1,000 leads / mo', '5 sender seats + rotation', 'Deep audits (perf, UX, SEO)', 'Auto-personalized outreach', 'Deliverability safeguards', 'Priority support'].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-slate-200 dark:text-slate-700">
                    <CheckCircle2 size={14} className="text-emerald-400" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl">Start Studio</button>
            </div>

            <div
              className="group bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col shadow-sm transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:border-slate-200 dark:hover:border-slate-700 relative overflow-hidden"
              style={{ transitionDelay: pricingGridReveal.visible ? '200ms' : '0ms' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute -top-12 -right-10 w-28 h-28 bg-sky-500/14 blur-3xl" />
                <div className="absolute -bottom-12 -left-8 w-24 h-24 bg-emerald-400/14 blur-3xl" />
              </div>
              <div className="absolute top-6 right-6 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[7px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">In development</div>
              <div className="mb-8">
                <h3 className="text-base md:text-lg font-extrabold text-slate-900 dark:text-white mb-1 md:mb-2">Agency+</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">$49.99</span>
                  <span className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-widest">/mo</span>
                </div>
                <p className="text-slate-500 dark:text-slate-400 text-xs md:text-sm mt-2">Unlimited scale with advanced AI automation.</p>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {[
                  'Unlimited leads',
                  'Unlimited sender seats + pools',
                  'AI playbooks & auto-sequencing',
                  'Gemini Site Check',
                  'Dynamic landing tear-downs',
                  'Deliverability guardrails + domain pools',
                  'Dedicated success (Q4 rollout)',
                ].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-4 border border-dashed border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">
                Join Waitlist
              </button>
            </div>
          </div>
        </main>
      )}

      <footer className="relative z-10 p-8 md:p-10 text-center mt-auto space-y-3">
        <div className="flex items-center justify-center gap-4 text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-slate-400">
          <a href="/privacy.html" className="hover:text-slate-900 dark:hover:text-white transition-colors">Privacy</a>
          <span className="w-1 h-1 rounded-full bg-slate-200 dark:bg-slate-800" />
          <a href="/terms.html" className="hover:text-slate-900 dark:hover:text-white transition-colors">Terms</a>
        </div>
        <p className="text-[8px] md:text-[10px] font-bold text-slate-300 dark:text-slate-800 uppercase tracking-widest">© 2025 GridLead Systems Inc. Built for solo creators.</p>
      </footer>
    </div>
  );
};

export default LandingPage;
