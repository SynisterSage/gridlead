
import React, { useState, useRef } from 'react';
import { Search, Send, BarChart3, ArrowRight, CheckCircle2, Globe, Shield, Activity, Users, Star, Layout, MousePointer2, Sparkles, Server, Cpu, Globe2, Menu, X, Rocket, Briefcase, Eye, ShieldCheck, Gauge, Sun, Moon } from 'lucide-react';
import { useTheme } from '../ThemeContext';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

type MarketingPage = 'home' | 'platform' | 'pricing';


const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted, onLogin }) => {
  const [activePage, setActivePage] = useState<MarketingPage>('home');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [demoQuery, setDemoQuery] = useState('');
  const [isDemoScanning, setIsDemoScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{name: string, score: number, issues: string[]} | null>(null);
  const { theme, toggleTheme } = useTheme();
  
  const featureSectionRef = useRef<HTMLDivElement>(null);

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
            <a 
              href="/privacy.html" 
              className="text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              Privacy
            </a>
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
          <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 text-center max-w-5xl mx-auto pt-16 md:pt-24 pb-20 animate-in fade-in duration-700">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-full mb-8">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Join 400+ Solo Web Creators</span>
            </div>
            
            <h1 className="text-5xl sm:text-7xl md:text-8xl font-extrabold text-slate-900 dark:text-white tracking-tighter leading-[0.9] mb-8">
              Your solo outreach <br /><span className="text-slate-300 dark:text-slate-700">automated.</span>
            </h1>
            
            <p className="text-lg md:text-xl text-slate-500 dark:text-slate-400 font-medium max-w-2xl mb-12">
              The B2B engine built for independent developers. Discovery, scoring, and personalized outreach in one unified workspace.
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
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="w-10 h-10 rounded-full border-4 border-white dark:border-slate-950 bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                    <Users size={14} />
                  </div>
                ))}
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Growing agencies daily</p>
            </div>
          </main>

          <section ref={featureSectionRef} className="bg-slate-50 dark:bg-slate-900/50 py-24 md:py-32 px-6 border-y border-slate-100 dark:border-slate-800">
            <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <div>
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
              
              <div className="bg-white dark:bg-slate-900 p-6 md:p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-2xl relative overflow-hidden min-h-[400px]">
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
                  <div className="h-full flex flex-col items-center justify-center text-center py-12">
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
          <div className="text-center mb-20 md:mb-32">
            <h2 className="text-4xl md:text-6xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-6 md:mb-8 leading-tight">Engineered for <br /><span className="text-slate-300 dark:text-slate-700">Conversion.</span></h2>
            <p className="text-slate-500 dark:text-slate-400 max-w-xl mx-auto font-medium leading-relaxed text-sm md:text-lg">Unified discovery-to-outreach pipeline that respects your time and your prospects' inbox.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-24 md:mb-40">
            {[
              { title: 'Mining', icon: Search, desc: 'Real-time database extraction targeting high-intent tech stack deficits.' },
              { title: 'Audits', icon: Sparkles, desc: 'Multi-point performance audits powered by top-tier technical intelligence.' },
              { title: 'Hub', icon: MousePointer2, desc: 'Unified command center for rotating accounts and managing thread health.' }
            ].map((item, i) => (
              <div key={i} className="p-8 md:p-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-[2rem] md:rounded-[3.5rem] shadow-sm transition-colors">
                <div className="w-12 h-12 md:w-14 md:h-14 bg-slate-50 dark:bg-slate-800 rounded-xl md:rounded-2xl flex items-center justify-center mb-6 md:mb-8 text-slate-900 dark:text-white">
                  <item.icon size={24} />
                </div>
                <h3 className="text-lg md:text-xl font-extrabold text-slate-900 dark:text-white mb-2 md:mb-4">{item.title}</h3>
                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{item.desc}</p>
              </div>
            ))}
          </div>

          <div className="p-10 md:p-20 bg-slate-900 dark:bg-slate-900/50 rounded-[3rem] md:rounded-[5rem] text-center text-white relative shadow-2xl overflow-hidden border border-slate-100/5 dark:border-slate-800">
            <h3 className="text-3xl md:text-5xl font-extrabold mb-8 relative z-10 leading-[0.95]">Ready to find <br /><span className="text-slate-500">high-intent clients?</span></h3>
            <button onClick={onGetStarted} className="relative z-10 px-10 py-4 bg-white text-slate-900 rounded-xl text-[10px] md:text-[11px] font-bold uppercase tracking-widest active:scale-95">
              Get Started Now
            </button>
          </div>
        </main>
      )}

      {activePage === 'pricing' && (
        <main className="relative z-10 flex-1 px-6 md:px-10 py-12 md:py-20 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-4">Pricing Plans</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base">Scale your outreach as you grow your agency.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] flex flex-col">
              <div className="mb-8">
                <h3 className="text-base md:text-lg font-extrabold text-slate-900 dark:text-white mb-1 md:mb-2">Solo</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white">$49</span>
                  <span className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-widest">/mo</span>
                </div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['500 Leads / mo', '2 Gmail Accounts', 'Standard Support'].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-slate-500 dark:text-slate-400">
                    <CheckCircle2 size={14} className="text-emerald-500" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-4 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all">Start Solo</button>
            </div>

            <div className="bg-slate-900 dark:bg-slate-100 p-8 md:p-10 rounded-[2rem] md:rounded-[2.5rem] text-white dark:text-slate-900 flex flex-col relative overflow-hidden">
              <div className="absolute top-6 right-6 bg-blue-500 text-white text-[7px] font-bold px-2 py-0.5 rounded uppercase tracking-widest">Most Popular</div>
              <div className="mb-8">
                <h3 className="text-base md:text-lg font-extrabold mb-1 md:mb-2">Pro</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl md:text-4xl font-extrabold">$99</span>
                  <span className="text-slate-400 font-bold text-[8px] md:text-[10px] uppercase tracking-widest">/mo</span>
                </div>
              </div>
              <ul className="space-y-4 mb-10 flex-1">
                {['Unlimited Leads', '10 Gmail Accounts', 'Priority Support', 'Deep Audits'].map((feat, i) => (
                  <li key={i} className="flex items-center gap-3 text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-600">
                    <CheckCircle2 size={14} className="text-blue-400" /> {feat}
                  </li>
                ))}
              </ul>
              <button onClick={onGetStarted} className="w-full py-4 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold uppercase tracking-widest hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-xl">Go Pro</button>
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
