
import React, { useState, useMemo } from 'react';
import { Search, Plus, Globe, Star, Zap, Layers, Filter, CheckCheck, Lightbulb } from 'lucide-react';
import { discoverLeadsAction } from '../services/geminiService';
import { Lead } from '../types';

interface HeroDiscoveryProps {
  onLeadAdd: (lead: Lead) => void;
}

const HeroDiscovery: React.FC<HeroDiscoveryProps> = ({ onLeadAdd }) => {
  const [query, setQuery] = useState('');
  const [radius, setRadius] = useState(15);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  
  const [minPotential, setMinPotential] = useState(0);
  const [minRating, setMinRating] = useState(0);

  const handleDiscovery = async () => {
    if (!query) return;
    setLoading(true);
    setHasSearched(true);
    
    try {
      const found = await discoverLeadsAction(query, 0, 0, radius);
      setResults(found);
    } catch (err) { console.error("Discovery failed", err); } finally { setLoading(false); }
  };

  const handlePushToQueue = (item: any) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newLead: Lead = {
      id,
      name: item.name,
      category: item.category,
      rating: item.rating,
      lastScan: 'Just now',
      website: item.website || 'No website found',
      status: 'pending',
      score: {
        design: Math.floor(Math.random() * 40) + 10,
        performance: Math.floor(Math.random() * 50) + 20,
        reviews: Math.floor((5 - (item.rating || 0)) * 20),
        trust: Math.floor(Math.random() * 60) + 30
      },
      notes: item.notes || `Discovered via search for "${query}".`
    };
    onLeadAdd(newLead);
    setAddedIds(prev => new Set(prev).add(item.name));
  };

  const filteredResults = useMemo(() => {
    return results
      .filter(item => (item.potentialScore || 0) >= minPotential && (item.rating || 0) >= minRating)
      .sort((a, b) => (b.potentialScore || 0) - (a.potentialScore || 0));
  }, [results, minPotential, minRating]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Discovery</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Mine local businesses and identify high-value opportunities.</p>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 md:p-4 rounded-[2rem] shadow-sm flex flex-col md:flex-row gap-4 items-center ring-1 ring-slate-100/50 dark:ring-slate-800/50">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} />
            <input 
              type="text"
              placeholder="Target niche (e.g. Roofers, Pizza, Spas)"
              className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl md:rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
              value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
            />
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto px-2 md:px-0">
            <div className="flex-1 md:flex-none flex flex-col gap-1 md:min-w-[120px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Radius</span>
                <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-900 dark:text-slate-300">{radius}km</span>
              </div>
              <input type="range" min="1" max="50" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-slate-900 dark:accent-white" />
            </div>
            <button onClick={handleDiscovery} disabled={loading || !query} className="bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-700 text-white dark:text-slate-900 text-[10px] font-bold h-11 px-6 md:px-8 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
              {loading ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white dark:border-slate-900/30 dark:border-t-slate-900 rounded-full animate-spin" /> : "Run Scan"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-2">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-64 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 rounded-[2rem] animate-pulse" />
            ))
          ) : (
            filteredResults.map((item, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 md:p-7 rounded-[2rem] md:rounded-[2.5rem] flex flex-col justify-between hover:border-[#0f172a] dark:hover:border-white hover:shadow-2xl transition-all group relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 ring-1 ring-slate-100/50 dark:ring-slate-800/50">
                {item.potentialScore > 85 && (
                  <div className="absolute top-4 right-4 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">High Value</div>
                )}
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white truncate tracking-tight text-sm md:text-base">{item.name}</h4>
                    <p className="text-[8px] md:text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-1">{item.category}</p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50/30 dark:bg-blue-900/10 rounded-xl border border-blue-50 dark:border-blue-900/30">
                       <Lightbulb size={12} className="text-blue-500 dark:text-blue-400" />
                       <span className="text-[9px] font-black uppercase tracking-tight text-blue-600 dark:text-blue-400">Target Opportunity</span>
                    </div>

                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800">
                      <Globe size={12} className="shrink-0 text-slate-400 dark:text-slate-600" />
                      <span className="truncate font-bold tracking-tight">{item.website || 'No website'}</span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1">
                        <span>Need Score</span>
                        <span className="text-slate-900 dark:text-white font-mono">{item.potentialScore}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100/50 dark:border-slate-800 shadow-inner">
                        <div className="h-full bg-slate-900 dark:bg-white transition-all duration-1000 ease-out" style={{ width: `${item.potentialScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => handlePushToQueue(item)}
                  disabled={addedIds.has(item.name)}
                  className={`mt-6 w-full py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                    addedIds.has(item.name) 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50' 
                    : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-[#0f172a] dark:hover:bg-white dark:hover:text-slate-900'
                  }`}
                >
                  {addedIds.has(item.name) ? "In Queue" : "Stage for Review"}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HeroDiscovery;
