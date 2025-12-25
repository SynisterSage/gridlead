
import React, { useState, useMemo, useEffect } from 'react';
import { Search, Globe, Lightbulb, MapPin, Loader2 } from 'lucide-react';
import { Lead } from '../types';
import { runDiscover, stageLeadPayloadFromResult, DiscoverResult } from '../services/discovery';

interface HeroDiscoveryProps {
  onLeadAdd: (lead: Lead) => Promise<void> | void;
}

const HeroDiscovery: React.FC<HeroDiscoveryProps> = ({ onLeadAdd }) => {
  const ZIP_STORAGE_KEY = 'gridlead_zip';
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(ZIP_STORAGE_KEY) || '';
  });
  const [radius, setRadius] = useState(15);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<DiscoverResult['results']>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [minRating, setMinRating] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [autoLocating, setAutoLocating] = useState(false);
  const [hasAutoLocated, setHasAutoLocated] = useState(false);

  const handleDiscovery = async () => {
    if (!query) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    setNextPageToken(undefined);

    try {
      const data = await runDiscover({
        query,
        location: location ? { zip: location, city: location } : undefined,
        radiusKm: radius,
        minRating,
      });
      if ((data.results || []).length === 0 && (minRating > 0 || (location && radius < 50))) {
        const relaxedRadius = Math.min(50, Math.max(radius, 25));
        const relaxed = await runDiscover({
          query,
          location: location ? { zip: location, city: location } : undefined,
          radiusKm: relaxedRadius,
          minRating,
        });
        setNotice('Expanded search to show more results.');
        setResults(relaxed.results || []);
        // Pagination disabled for now (testing): keep to first page only.
        setNextPageToken(undefined);
      } else {
        setResults(data.results || []);
        // Pagination disabled for now (testing): keep to first page only.
        setNextPageToken(undefined);
      }
    } catch (err: any) {
      console.error("Discovery failed", err);
      setError(err?.message || 'Unable to run discovery');
    } finally {
      setLoading(false);
    }
  };

  const handlePushToQueue = (item: DiscoverResult['results'][number]) => {
    const newLead = stageLeadPayloadFromResult(item);
    onLeadAdd(newLead);
    setAddedIds(prev => new Set(prev).add(item.id));
  };

  const filteredResults = useMemo(() => {
    return results
      .filter(item => (item.rating || 0) >= minRating)
      .sort((a, b) => (b.potentialScore || 0) - (a.potentialScore || 0));
  }, [results, minRating]);

  const DiscoverySkeleton: React.FC = () => (
    <div className="relative p-6 md:p-7 rounded-[2rem] md:rounded-[2.5rem] border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900/40 animate-pulse">
      {/* badge placeholders (left + icon-only right) */}
      <div className="absolute top-6 left-6 w-8 h-5 rounded-md bg-[#0f172a] dark:bg-white/10" />
      <div className="absolute top-6 right-6 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center" />
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />

        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-100/50 dark:border-slate-800" />
        <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-100/50 dark:border-slate-800" />

        <div className="space-y-1">
          <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100/50 dark:border-slate-800 shadow-inner">
            <div className="h-full bg-slate-900 dark:bg-white" style={{ width: '40%' }} />
          </div>
        </div>

        <div className="mt-4">
          <div className="h-12 rounded-xl bg-slate-200 dark:bg-slate-700" />
        </div>
      </div>
    </div>
  );

  // Auto-fill ZIP via browser geolocation + public reverse geocode (no key) for convenience.
  useEffect(() => {
    if (hasAutoLocated || location) return;
    if (!('geolocation' in navigator)) return;
    setAutoLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`);
          if (res.ok) {
            const data = await res.json();
            const postal = data?.postcode || data?.postalCode || '';
            if (postal) {
              setLocation(postal);
            }
          }
        } catch (_e) {
          // ignore
        } finally {
          setAutoLocating(false);
          setHasAutoLocated(true);
        }
      },
      () => {
        setAutoLocating(false);
        setHasAutoLocated(true);
      },
      { maximumAge: 60_000, timeout: 6_000 }
    );
  }, [hasAutoLocated, location]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (location) {
      localStorage.setItem(ZIP_STORAGE_KEY, location);
    }
  }, [location]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 pt-12 md:pt-20 pb-32 animate-in fade-in duration-700">
      <div className="mb-8 md:mb-12">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 dark:text-white mb-2 tracking-tight">Discovery</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm md:text-lg font-medium">Mine local businesses and identify high-value opportunities.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-3 md:p-4 rounded-[2rem] shadow-sm flex flex-col gap-3 md:gap-4 ring-1 ring-slate-100/50 dark:ring-slate-800/50">
          <div className="flex flex-col md:flex-row gap-2 md:gap-3 items-stretch md:items-center">
            <div className="relative flex-1 w-full md:min-w-[280px]">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} />
              <input 
                type="text"
                placeholder="Target niche (e.g. Roofers, Pizza, Spas)"
                className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl md:rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
              />
            </div>
            <div className="relative w-full md:w-auto md:min-w-[150px] md:max-w-[200px]">
              <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={16} />
              <input 
                type="text"
                placeholder="ZIP or City"
                className="w-full bg-slate-50 dark:bg-slate-950 border-none rounded-xl md:rounded-2xl py-3.5 pl-12 pr-4 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900/10 dark:focus:ring-white/10 transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700"
                value={location} onChange={(e) => setLocation(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleDiscovery()}
              />
            </div>
            <button onClick={handleDiscovery} disabled={loading || !query} className="w-full md:w-auto bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-200 disabled:bg-slate-50 dark:disabled:bg-slate-800 disabled:text-slate-300 dark:disabled:text-slate-700 text-white dark:text-slate-900 text-[10px] font-bold h-11 px-6 md:px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm">
              {loading ? <Loader2 className="animate-spin" size={14} /> : "Run Scan"}
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-6">
            <div className="flex flex-1 flex-col gap-1 min-w-[140px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Radius</span>
                <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-900 dark:text-slate-300">{radius}km</span>
              </div>
              <input type="range" min="1" max="50" value={radius} onChange={(e) => setRadius(parseInt(e.target.value))} className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-slate-900 dark:accent-white" />
            </div>
            <div className="flex flex-1 flex-col gap-1 min-w-[140px]">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest">Min Rating</span>
                <span className="text-[8px] md:text-[9px] font-mono font-bold text-slate-900 dark:text-slate-300">{minRating.toFixed(1)}</span>
              </div>
              <input type="range" min="0" max="5" step="0.5" value={minRating} onChange={(e) => setMinRating(parseFloat(e.target.value))} className="w-full h-1 bg-slate-100 dark:bg-slate-800 rounded-full appearance-none cursor-pointer accent-slate-900 dark:accent-white" />
            </div>
          </div>
          {error && <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">{error}</p>}
          {notice && <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">{notice}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 pt-2">
          {loading ? (
            // Responsive skeleton: 3 on mobile, up to 6 on larger screens
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={`${i >= 3 ? 'hidden md:block' : ''}`}>
                <DiscoverySkeleton />
              </div>
            ))
          ) : (
            filteredResults.map((item, i) => (
              <div key={i} className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-6 md:p-7 rounded-[2rem] md:rounded-[2.5rem] flex flex-col hover:border-[#0f172a] dark:hover:border-white hover:shadow-2xl transition-all relative overflow-hidden animate-in fade-in zoom-in-95 duration-300 ring-1 ring-slate-100/50 dark:ring-slate-800/50">
                {item.potentialScore >= 80 && item.website && (
                  <div className="absolute top-6 left-6 bg-[#0f172a] dark:bg-white text-white dark:text-slate-900 text-[7px] font-bold px-2 py-0.5 rounded-md uppercase tracking-widest shadow-sm">
                    High Value
                  </div>
                )}

                {(!item.website || (item.potentialScore >= 65)) && (
                  <div className="absolute top-6 right-6">
                    <div className="group relative inline-flex">
                      <button aria-label="Target opportunity" className="w-8 h-8 rounded-full bg-blue-50/30 dark:bg-blue-900/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
                        <Lightbulb size={14} />
                      </button>
                      <div className="absolute -top-10 right-1 hidden group-hover:block z-50">
                        <div className="whitespace-nowrap px-3 py-1 rounded-md bg-slate-900 text-white text-[11px] font-medium shadow-lg dark:bg-white dark:text-slate-900">
                          Target opportunity
                        </div>
                        <div className="absolute left-1/2 transform -translate-x-1/2 top-full w-2 h-2 bg-slate-900 rotate-45 dark:bg-white" />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2.5">
                  <div>
                    <h4 className="font-extrabold text-slate-900 dark:text-white truncate tracking-tight text-sm md:text-base">{item.name}</h4>
                    <p className="text-[8px] md:text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest mt-1">{item.category}</p>
                  </div>

                  <div className="space-y-3">
                    {/* Target Opportunity badge moved to top-right for consistent card heights */}

                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800">
                      <Globe size={12} className="shrink-0 text-slate-400 dark:text-slate-600" />
                      <span className="truncate font-bold tracking-tight">{item.website || 'No website'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] md:text-[10px] text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-100/50 dark:border-slate-800">
                      <MapPin size={12} className="shrink-0 text-slate-400 dark:text-slate-600" />
                      <span className="truncate font-bold tracking-tight">{item.address || 'No address'}</span>
                    </div>
                    
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center text-[8px] md:text-[9px] font-bold text-slate-400 dark:text-slate-600 uppercase tracking-widest px-1">
                        <span className="flex items-center gap-1 relative group/needscore">
                          Need Score
                          <span className="text-slate-300 dark:text-slate-600 cursor-help">?</span>
                          <div className="absolute top-full left-0 mt-2 w-64 p-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-2xl opacity-0 invisible group-hover/needscore:opacity-100 group-hover/needscore:visible transition-all duration-200 text-[9px] font-medium leading-relaxed z-10 pointer-events-none">
                            Heuristic only: +25 no website, rating &lt;3 (+18), rating 3-3.9 (+10), rating ≥4 (-15), local service niches (+5), missing address (-5). Deep Audit refines scores in Review.
                          </div>
                        </span>
                        <span className="text-slate-900 dark:text-white font-mono">{item.potentialScore}%</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-50 dark:bg-slate-950 rounded-full overflow-hidden border border-slate-100/50 dark:border-slate-800 shadow-inner">
                        <div className="h-full bg-slate-900 dark:bg-white transition-all duration-1000 ease-out" style={{ width: `${item.potentialScore}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-6 w-full">
                  <button 
                    onClick={() => handlePushToQueue(item)}
                    disabled={addedIds.has(item.id)}
                    className={`w-full py-3 rounded-xl md:rounded-2xl text-[9px] md:text-[10px] font-bold transition-all flex items-center justify-center gap-2 shadow-sm ${
                      addedIds.has(item.id) 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/50' 
                      : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-[#0f172a] dark:hover:bg-white dark:hover:text-slate-900'
                    }`}
                  >
                    {addedIds.has(item.id) ? "In Queue" : "Stage for Review"}
                  </button>
                </div>
              </div>
            ))
          )}
            {/* Empty state when a search has not yet returned results */}
            {!loading && filteredResults.length === 0 && (
                <div className="col-span-1 sm:col-span-2 lg:col-span-3 py-20 text-center opacity-20">
                    <Search size={36} className="mx-auto mb-2" />
                    <p className="text-[9px] font-black uppercase tracking-widest">Start a scan to surface opportunities</p>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default HeroDiscovery;
