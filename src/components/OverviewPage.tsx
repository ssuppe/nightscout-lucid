import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle,
  Printer,
  Download,
  Mail,
  Share2,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Award,
  FileText
} from 'lucide-react';
import { NightscoutClient, GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry, NightscoutTreatment } from '../utils/nightscout';
import { 
  calculateGlucoseMetrics, 
  calculateAGPPercentiles, 
  calculate15MinGlucoseStats,
  deduplicateTreatments
} from '../utils/metrics';
import type { GlucoseMetrics } from '../utils/metrics';
import { AGPChart } from './AGPChart';
import { HourlyGlucoseChart } from './HourlyGlucoseChart';
import { DailyMiniChart } from './DailyMiniChart';
import { WeeklyOverlayChart } from './WeeklyOverlayChart';
import { DailyStatsTable } from './DailyStatsTable';
import { HourlyStatsTable } from './HourlyStatsTable';

interface OverviewPageProps {
  client: NightscoutClient;
  preferredUnits: GlucoseUnit;
  onDisconnect: () => void;
}

export const OverviewPage: React.FC<OverviewPageProps> = ({
  client,
  preferredUnits,
  onDisconnect
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'overlay' | 'daily' | 'compare' | 'stats' | 'agp'>('overview');
  const [dateRangeDays, setDateRangeDays] = useState<number>(14);
  const [units, setUnits] = useState<GlucoseUnit>(preferredUnits);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [entries, setEntries] = useState<NightscoutEntry[]>([]);
  const [treatments, setTreatments] = useState<NightscoutTreatment[]>([]);
  const [metrics, setMetrics] = useState<GlucoseMetrics | null>(null);
  const [dateRangeStr, setDateRangeStr] = useState<string>('');

  // Overlay Filters States
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [eventFilter, setEventFilter] = useState<'all' | 'highs' | 'lows'>('all');

  // Statistics Sub-tab State
  const [statsSubTab, setStatsSubTab] = useState<'daily' | 'hourly'>('daily');

  // Device Info Panel State
  const [devicePanelExpanded, setDevicePanelExpanded] = useState<boolean>(true);

  const loadData = async (days: number) => {
    setLoading(true);
    setError(null);

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    const formatDate = (d: Date) => d.toLocaleDateString(undefined, { 
      weekday: 'short',
      day: 'numeric', 
      month: 'short', 
      year: 'numeric' 
    });
    setDateRangeStr(`${formatDate(from)} - ${formatDate(to)}`);

    try {
      const fetched = await client.fetchEntries(from, to);
      setEntries(fetched);
      const computed = calculateGlucoseMetrics(fetched, units);
      setMetrics(computed);

      // Fetch treatments and handle failures gracefully
      try {
        const fetchedTreatments = await client.fetchTreatments(from, to);
        setTreatments(deduplicateTreatments(fetchedTreatments));
      } catch (tErr) {
        console.warn('Failed to load treatments:', tErr);
        setTreatments([]);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load glucose data from Nightscout');
    } finally {
      setLoading(false);
    }
  };

  // Reload data when date range changes
  useEffect(() => {
    loadData(dateRangeDays);
  }, [dateRangeDays]);

  // Recalculate metrics when preferred unit changes, without re-fetching
  useEffect(() => {
    if (entries.length > 0) {
      const computed = calculateGlucoseMetrics(entries, units);
      setMetrics(computed);
    }
  }, [units, entries]);

  const activeSensorDays = Math.min(dateRangeDays, Math.ceil(
    entries.length > 0 
      ? (entries[0].date - entries[entries.length - 1].date) / (1000 * 60 * 60 * 24)
      : 1
  ));
  
  // Calculate distinct days containing CGM logs
  const getDaysWithDataCount = () => {
    if (entries.length === 0) return 0;
    const uniqueDays = new Set(entries.map(e => new Date(e.date).toDateString()));
    return Math.min(dateRangeDays, uniqueDays.size);
  };

  const avgReadingsPerDay = entries.length > 0 
    ? Math.round(entries.length / Math.max(activeSensorDays, 1)) 
    : 0;
  
  const wearPercentage = Math.min(100, Math.round((avgReadingsPerDay / 288) * 100));

  // Construct list of calendar days for Daily Logs
  const getDaysArray = () => {
    const arr = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dateRangeDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      arr.push(d);
    }
    return arr;
  };

  // Group date range into weekly slots (7-day intervals starting from today going back)
  const getWeeksArray = () => {
    const weeks = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < dateRangeDays; i += 7) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - i);
      weekEnd.setHours(23, 59, 59, 999);

      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      weeks.push({ start: weekStart, end: weekEnd });
    }
    return weeks;
  };

  const getBestDay = () => {
    if (entries.length === 0) return { dateStr: '-', tir: 0 };
    const days = getDaysArray();
    let bestDayDate = days[0];
    let bestDayTIR = 0;

    days.forEach(day => {
      const start = day.getTime();
      const end = start + 24 * 60 * 60 * 1000 - 1;
      const dayEntries = entries.filter(e => e.date >= start && e.date <= end);
      if (dayEntries.length > 0) {
        const inRangeCount = dayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
        const tir = Math.round((inRangeCount / dayEntries.length) * 100);
        if (tir > bestDayTIR) {
          bestDayTIR = tir;
          bestDayDate = day;
        }
      }
    });

    const dateStr = bestDayDate.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    return { dateStr, tir: bestDayTIR };
  };

  const handleDayToggle = (day: number) => {
    if (selectedDays.includes(day)) {
      setSelectedDays(selectedDays.filter(d => d !== day));
    } else {
      setSelectedDays([...selectedDays, day]);
    }
  };

  const selectAllDays = () => setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  const selectWeekdays = () => setSelectedDays([1, 2, 3, 4, 5]);
  const selectWeekends = () => setSelectedDays([0, 6]);

  const weekdays = [
    { label: 'Sun', value: 0 },
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 }
  ];

  const formatPctLabel = (pct: number, count: number) => {
    if (pct === 0 && count > 0) return '<1%';
    return `${pct}%`;
  };

  const latestUploadDateStr = entries.length > 0 
    ? new Date(entries[0].date).toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      })
    : '-';

  const bestDayInfo = getBestDay();
  const isMgdl = units === GlucoseUnit.MGDL;
  const formattedMean = metrics ? (isMgdl ? metrics.mean.toFixed(0) : metrics.mean.toFixed(1)) : '';
  const formattedStdDev = metrics ? (isMgdl ? metrics.stdDev.toFixed(0) : metrics.stdDev.toFixed(1)) : '';

  return (
    <div className="min-h-screen bg-[#F4F5F6] text-slate-800 font-sans antialiased font-medium flex flex-col">
      
      {/* Top Accent Strip - Clarity Green */}
      <div className="h-1.5 w-full bg-[#72B100] shrink-0" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm shrink-0">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5">
          
          {/* Logo & Project Title */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-800 text-lg uppercase tracking-tight font-sans">
                Nightscout <span className="text-[#72B100]">Lucid</span>
              </span>
            </div>

            {/* Top Navigation Links */}
            <nav className="hidden md:flex items-center space-x-1">
              <button className="px-4 py-2 text-sm font-extrabold text-[#72B100] border-b-2 border-[#72B100]">
                Reports
              </button>
              <button className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 transition cursor-not-allowed" disabled>
                Upload
              </button>
              <button className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-slate-700 transition cursor-not-allowed" disabled>
                Settings
              </button>
            </nav>
          </div>

          {/* Action Menu */}
          <div className="flex items-center gap-4">
            {/* Preferred Unit Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setUnits(GlucoseUnit.MGDL)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  units === GlucoseUnit.MGDL 
                    ? 'bg-[#72B100] text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                mg/dL
              </button>
              <button
                onClick={() => setUnits(GlucoseUnit.MMOL)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition cursor-pointer ${
                  units === GlucoseUnit.MMOL 
                    ? 'bg-[#72B100] text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                mmol/L
              </button>
            </div>

            {/* Profile Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold text-slate-700 hover:text-slate-900 border border-slate-200 rounded-md bg-slate-50/50 cursor-pointer">
                <span>Steven Suppe</span>
                <span className="text-[10px] text-slate-400">▼</span>
              </button>
              <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-50">
                <a href="#" className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-bold">Manage Consent</a>
                <a href="#" className="block px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 font-bold">Manage Profile</a>
                <button
                  onClick={onDisconnect}
                  className="w-full text-left block px-4 py-2 text-xs text-red-600 hover:bg-red-50 font-bold border-t border-slate-100 cursor-pointer"
                >
                  Logout / Disconnect
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Split Workspace */}
      <div className="flex-1 flex max-w-7xl w-full mx-auto px-6 py-6 gap-6 min-h-0">
        
        {/* Left Sidebar Navigation */}
        <aside className="w-52 shrink-0 hidden md:block">
          <div className="bg-white border border-slate-200 rounded-xl py-3 shadow-sm">
            <div className="px-4 py-2 text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">
              Reports
            </div>
            <nav className="space-y-0.5">
              {[
                { id: 'overview', label: 'Overview' },
                { id: 'patterns', label: 'Patterns' },
                { id: 'overlay', label: 'Overlay' },
                { id: 'daily', label: 'Daily' },
                { id: 'compare', label: 'Compare' },
                { id: 'stats', label: 'Statistics' },
                { id: 'agp', label: 'AGP' }
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={`w-full text-left px-4 py-2.5 text-sm font-extrabold transition border-l-3 cursor-pointer ${
                    activeTab === item.id
                      ? 'bg-[#72B100]/5 text-[#72B100] border-[#72B100]'
                      : 'border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Right Content Space */}
        <main className="flex-1 min-w-0 flex flex-col gap-6 overflow-y-auto pr-1">
          
          {/* Header Row */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight capitalize">
                {activeTab === 'stats' ? 'Statistics' : activeTab}
              </h1>
              
              {/* Date Range Picker */}
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                <span className="text-xs font-black text-slate-800">{dateRangeDays} days</span>
                <span className="text-xs text-slate-400">|</span>
                <span className="text-xs text-slate-500 font-bold">{dateRangeStr}</span>
              </div>
            </div>

            {/* Actions & Range selections */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                {[7, 14, 30, 90].map((days) => (
                  <button
                    key={days}
                    onClick={() => setDateRangeDays(days)}
                    className={`rounded-md px-3 py-1 text-xs font-bold transition cursor-pointer ${
                      dateRangeDays === days
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {days}d
                  </button>
                ))}
              </div>

              {/* Icon Bar */}
              <div className="flex items-center gap-1 border-l border-slate-200 pl-3">
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" title="Print">
                  <Printer className="h-4 w-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" title="Download PDF">
                  <Download className="h-4 w-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" title="Email Reports">
                  <Mail className="h-4 w-4" />
                </button>
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" title="Export CSV">
                  <Share2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-slate-800 shadow-sm">
              <div className="flex gap-3">
                <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-red-800">Failed to sync data</h3>
                  <p className="mt-1 font-mono text-xs text-slate-500">{error}</p>
                  <button 
                    onClick={() => loadData(dateRangeDays)}
                    className="mt-3 rounded bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 transition hover:bg-red-200 cursor-pointer"
                  >
                    Retry Fetch
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading Spinner */}
          {loading ? (
            <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 bg-white border border-slate-200 rounded-xl shadow-sm">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-4 border-slate-100"></div>
                <div className="absolute top-0 left-0 h-10 w-10 rounded-full border-4 border-t-[#72B100] animate-spin"></div>
              </div>
              <p className="text-xs font-bold text-slate-400 animate-pulse">Loading Nightscout data...</p>
            </div>
          ) : metrics ? (
            <div className="space-y-6">

              {/* OVERVIEW TAB */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  
                  {/* Three-Card Statistics Panel */}
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                    
                    {/* Card 1: Glucose statistics card */}
                    <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <a href="#" className="absolute right-3 top-3 text-slate-300 hover:text-slate-500" title="Glossary">
                        <HelpCircle className="h-4 w-4" />
                      </a>
                      
                      <div className="p-5 grid grid-cols-2 gap-y-6 gap-x-8">
                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Average glucose</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-3xl font-black text-slate-800">{formattedMean}</span>
                            <span className="text-xs text-slate-400 font-extrabold uppercase">{units}</span>
                          </div>
                        </div>

                        <div>
                          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">GMI</div>
                          <div className="mt-1 text-3xl font-black text-slate-800">{metrics.gmi}%</div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <div className="text-[10px] font-bold text-slate-400">Standard deviation</div>
                          <div className="mt-1 flex items-baseline gap-1">
                            <span className="text-lg font-black text-slate-700">{formattedStdDev}</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">{units}</span>
                          </div>
                        </div>

                        <div className="border-t border-slate-100 pt-4">
                          <div className="text-[10px] font-bold text-slate-400">Coefficient of Variation</div>
                          <div className="mt-1 text-lg font-black text-slate-700">{metrics.cv}%</div>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Time in Range Card */}
                    <div className="lg:col-span-4 bg-white border border-slate-200 rounded-xl shadow-sm relative p-5 flex flex-col justify-between">
                      <a href="#" className="absolute right-3 top-3 text-slate-300 hover:text-slate-500" title="Glossary">
                        <HelpCircle className="h-4 w-4" />
                      </a>

                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Time in Range</div>
                        
                        <div className="flex gap-5 items-center">
                          {/* Resistor-style stacked bar */}
                          <div className="flex h-[108px] w-[50px] flex-col overflow-hidden rounded-[3px] bg-slate-100 border border-slate-200/50 shadow-inner shrink-0">
                            {metrics.timeInVeryHigh > 0 && <div style={{ height: `${metrics.timeInVeryHigh}%` }} className="bg-[#F29100]" />}
                            {metrics.timeInHigh > 0 && <div style={{ height: `${metrics.timeInHigh}%` }} className="bg-[#FCD116]" />}
                            {metrics.timeInTarget > 0 && <div style={{ height: `${metrics.timeInTarget}%` }} className="bg-[#72B100]" />}
                            {metrics.timeInLow > 0 && <div style={{ height: `${metrics.timeInLow}%` }} className="bg-[#F04124]" />}
                            {metrics.timeInVeryLow > 0 && <div style={{ height: `${metrics.timeInVeryLow}%` }} className="bg-[#9C0006]" />}
                          </div>

                          {/* Legends list */}
                          <div className="flex-1 flex flex-col justify-between py-0.5 text-[11px] font-bold text-slate-500 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F29100]" />
                                <span>Very high</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInVeryHigh, entries.filter(e => e.sgv > 250).length)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FCD116]" />
                                <span>High</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInHigh, entries.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#72B100]" />
                                <span className="text-[#527e00]">In range</span>
                              </div>
                              <span className="text-[#72B100] font-black">{metrics.timeInTarget}%</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F04124]" />
                                <span>Low</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInLow, entries.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#9C0006]" />
                                <span>Very low</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInVeryLow, entries.filter(e => e.sgv < 54).length)}</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Target Range:</span>
                        <span className="text-slate-600 font-extrabold">{isMgdl ? '70-180 mg/dL' : '3.9-10.0 mmol/L'}</span>
                      </div>
                    </div>

                    {/* Card 3: Sensor Usage Card */}
                    <div className="lg:col-span-3 bg-white border border-slate-200 rounded-xl shadow-sm relative p-5 flex flex-col justify-between">
                      <a href="#" className="absolute right-3 top-3 text-slate-300 hover:text-slate-500" title="Glossary">
                        <HelpCircle className="h-4 w-4" />
                      </a>

                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Sensor usage</div>
                        
                        <div className="space-y-4">
                          <div>
                            <div className="text-[10px] font-bold text-slate-400">Days with data</div>
                            <div className="mt-0.5 flex items-baseline gap-1 text-slate-800 font-black">
                              <span className="text-2xl">{getDaysWithDataCount()}/{dateRangeDays}</span>
                              <span className="text-[10px] text-slate-400 font-bold uppercase">Days</span>
                            </div>
                          </div>

                          <div>
                            <div className="text-[10px] font-bold text-slate-400">Time active</div>
                            <div className="mt-0.5 text-2xl text-slate-800 font-black">
                              {wearPercentage}%
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] font-bold text-slate-400">
                        <span>Avg. calibrations/day:</span>
                        <span className="text-slate-600 font-extrabold">0.0</span>
                      </div>
                    </div>

                  </div>

                  {/* Trends Graph Block */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-sm font-extrabold text-slate-700 mb-6">
                      This graph shows your data averaged over {dateRangeDays} days
                    </h3>
                    
                    <HourlyGlucoseChart 
                      hourlyStats={calculate15MinGlucoseStats(entries, units)} 
                      units={units} 
                    />

                    {/* Dexcom EU Styled HTML Legend */}
                    <div className="mt-6 flex flex-col md:flex-row items-center justify-center gap-8 border-t border-slate-100 pt-5 text-[11px] font-bold text-slate-400">
                      
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-6 rounded bg-[#FCD116]" />
                        <span>Above High Threshold</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          <span className="w-3 h-0.5 bg-slate-300" />
                          <span className="w-2.5 h-2.5 rounded-full bg-blue-600 border border-white" />
                          <span className="w-3 h-0.5 bg-slate-300" />
                          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                        </div>
                        <div>
                          <span className="mr-2">15th Percentile</span>
                          <span className="text-blue-600 mr-2">Average</span>
                          <span>75th Percentile</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-6 rounded bg-[#F04124]" />
                        <span>Below Low Threshold</span>
                      </div>
                    </div>
                  </div>

                  {/* Patterns Box */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
                    <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">Patterns</h3>
                    
                    <h2 className="text-md font-black text-slate-800 mb-4">
                      We found no patterns during this date range. <br />
                      <span className="text-slate-500 text-sm font-bold">The best day was {bestDayInfo.dateStr}.</span>
                    </h2>

                    <div className="border border-slate-100 rounded-lg p-4 flex items-center justify-between hover:bg-slate-50/30 transition">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-[#72B100]/5 text-[#72B100] rounded-full">
                          <Award className="h-6 w-6 stroke-[2.5]" />
                        </div>
                        <div>
                          <h4 className="text-sm font-extrabold text-slate-800">Steven's best glucose day</h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-bold">
                            Steven's glucose data was in the target range about {bestDayInfo.tir}% of the day.
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-300" />
                    </div>
                  </div>

                  {/* Devices Section */}
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
                    <h2 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">Devices</h2>
                    
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Device Header */}
                      <button 
                        onClick={() => setDevicePanelExpanded(!devicePanelExpanded)}
                        className="w-full flex items-center justify-between px-5 py-4 bg-slate-50 hover:bg-slate-100/70 transition text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Smartphone className="h-5 w-5 text-slate-500" />
                          <span className="font-extrabold text-slate-800">Dexcom G6</span>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${devicePanelExpanded ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Device Content */}
                      {devicePanelExpanded && (
                        <div className="p-5 border-t border-slate-200 bg-white grid grid-cols-1 md:grid-cols-2 gap-8 text-xs font-semibold text-slate-600">
                          
                          {/* Info Column */}
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">CGM ID</h3>
                            <table className="w-full text-left space-y-2">
                              <tbody>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Serial Number</td>
                                  <td className="py-2 text-slate-800 font-black">Android</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Uploaded On</td>
                                  <td className="py-2 text-slate-800 font-black">{latestUploadDateStr}</td>
                                </tr>
                                <tr>
                                  <td className="py-2 text-slate-400 font-bold">Sensor</td>
                                  <td className="py-2 text-slate-800 font-black">G6</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                          {/* Alert Settings Column */}
                          <div>
                            <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Alert Settings for Device</h3>
                            <table className="w-full text-left">
                              <tbody>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Low Alert</td>
                                  <td className="py-2 text-slate-500 font-extrabold">Off</td>
                                  <td className="py-2 text-right text-slate-400 font-bold">15 min repeat</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">High Alert</td>
                                  <td className="py-2 text-slate-500 font-extrabold">Off</td>
                                  <td className="py-2 text-right text-slate-400 font-bold">0 min repeat</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Fall Rate Alert</td>
                                  <td className="py-2 text-slate-500 font-extrabold" colSpan={2}>Off</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Rise Rate Alert</td>
                                  <td className="py-2 text-slate-500 font-extrabold" colSpan={2}>Off</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Urgent Low Alert</td>
                                  <td className="py-2 text-slate-800 font-black">On</td>
                                  <td className="py-2 text-right text-slate-800 font-black">{isMgdl ? '55 mg/dL' : '3.1 mmol/L'}</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Urgent Low Repeat</td>
                                  <td className="py-2 text-slate-800 font-black">On</td>
                                  <td className="py-2 text-right text-slate-800 font-black">30 min</td>
                                </tr>
                                <tr className="border-b border-slate-50">
                                  <td className="py-2 text-slate-400 font-bold">Urgent Low Soon</td>
                                  <td className="py-2 text-slate-500 font-extrabold" colSpan={2}>Off</td>
                                </tr>
                                <tr>
                                  <td className="py-2 text-slate-400 font-bold">Signal Loss Alert</td>
                                  <td className="py-2 text-slate-500 font-extrabold" colSpan={2}>Off</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>

                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

              {/* PATTERNS TAB */}
              {activeTab === 'patterns' && (
                <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-left">
                  <h3 className="text-sm font-extrabold text-slate-400 uppercase tracking-wider mb-4">Patterns</h3>
                  <h2 className="text-md font-black text-slate-800 mb-6">
                    We found no patterns during this date range.<br />
                    <span className="text-slate-500 text-sm font-bold">The best day was {bestDayInfo.dateStr}.</span>
                  </h2>

                  <div className="border border-slate-100 rounded-lg p-5 flex items-center justify-between hover:bg-slate-50/30 transition">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#72B100]/5 text-[#72B100] rounded-full">
                        <Award className="h-6 w-6 stroke-[2.5]" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-800">Steven's best glucose day</h4>
                        <p className="text-xs text-slate-500 mt-1 font-bold">
                          Steven's glucose data was in the target range about {bestDayInfo.tir}% of the day.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </div>
              )}

              {/* COMPARE TAB PLACEHOLDER */}
              {activeTab === 'compare' && (
                <div className="bg-white border border-slate-200 rounded-xl p-10 shadow-sm text-center max-w-xl mx-auto my-8">
                  <FileText className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                  <h3 className="text-lg font-black text-slate-800">Comparison reports</h3>
                  <p className="text-xs text-slate-500 mt-2 font-bold leading-relaxed">
                    Select a second date range to compare with your current reports. Comparison views require additional historical logs from your CGM.
                  </p>
                </div>
              )}

              {/* WEEKLY OVERLAY TAB */}
              {activeTab === 'overlay' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start text-left">
                  
                  {/* Filters sidebar */}
                  <div className="lg:col-span-3 space-y-6">
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-5">
                      
                      {/* Event Filtering */}
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-2.5">Event Filtering</h4>
                        <div className="flex flex-col gap-2">
                          <button
                            onClick={() => setEventFilter('all')}
                            className={`w-full text-left rounded-lg px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                              eventFilter === 'all'
                                ? 'bg-slate-100 text-slate-800 border-slate-300'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            All Days
                          </button>
                          <button
                            onClick={() => setEventFilter('highs')}
                            className={`w-full text-left rounded-lg px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                              eventFilter === 'highs'
                                ? 'bg-amber-50 text-amber-700 border-amber-300'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Days with Highs (&gt; 180 / 10.0)
                          </button>
                          <button
                            onClick={() => setEventFilter('lows')}
                            className={`w-full text-left rounded-lg px-3 py-2 text-xs font-bold transition border cursor-pointer ${
                              eventFilter === 'lows'
                                ? 'bg-red-50 text-red-700 border-red-300'
                                : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            Days with Lows (&lt; 70 / 3.9)
                          </button>
                        </div>
                      </div>

                      {/* Days of Week */}
                      <div className="border-t border-slate-100 pt-4">
                        <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-3">Days of Week</h4>
                        <div className="space-y-2">
                          {weekdays.map((day) => (
                            <label key={day.value} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedDays.includes(day.value)}
                                onChange={() => handleDayToggle(day.value)}
                                className="h-4 w-4 rounded border-slate-300 text-[#72B100] focus:ring-[#72B100]/20 cursor-pointer"
                              />
                              <span>{day.label}</span>
                            </label>
                          ))}
                        </div>

                        {/* Quick controls */}
                        <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-50">
                          <button
                            onClick={selectAllDays}
                            className="rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            All
                          </button>
                          <button
                            onClick={selectWeekdays}
                            className="rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            Weekdays
                          </button>
                          <button
                            onClick={selectWeekends}
                            className="rounded bg-slate-50 border border-slate-200 px-2.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 cursor-pointer"
                          >
                            Weekends
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* Weekly overlay list */}
                  <div className="lg:col-span-9 space-y-6">
                    {getWeeksArray().map((week, idx) => {
                      const weekEntries = entries.filter(
                        e => e.date >= week.start.getTime() && e.date <= week.end.getTime()
                      );
                      const weekLabel = `Week of ${week.start.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric'
                      })} - ${week.end.toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}`;

                      return (
                        <div key={idx} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                          <WeeklyOverlayChart
                            entries={weekEntries}
                            units={units}
                            selectedDays={selectedDays}
                            eventFilter={eventFilter}
                            weekLabel={weekLabel}
                          />
                        </div>
                      );
                    })}
                  </div>

                </div>
              )}

              {/* AGP PROFILE TAB */}
              {activeTab === 'agp' && (
                <div className="space-y-6">
                  
                  {/* Stats header */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                    <div className="md:col-span-6 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-100 pb-6 md:pb-0 md:pr-6">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Glucose Statistics</h3>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Average Glucose</span>
                            <div className="text-2xl font-extrabold text-slate-800">{formattedMean} <span className="text-xs text-slate-400 font-bold">{units}</span></div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">GMI</span>
                            <div className="text-2xl font-extrabold text-slate-800">{metrics.gmi}%</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Glucose Variability</span>
                            <div className="text-2xl font-extrabold text-slate-800">{metrics.cv}% <span className="text-xs text-slate-400 font-bold">CV</span></div>
                            <div className="text-[10px] text-slate-400 font-medium">SD: ±{formattedStdDev} {units}</div>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold uppercase">Active Wear</span>
                            <div className="text-2xl font-extrabold text-slate-800">{wearPercentage}%</div>
                            <div className="text-[10px] text-slate-400 font-medium">{activeSensorDays} Days of Data</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-6 flex flex-col justify-between md:pl-6">
                      <div>
                        <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-4">Time in Range</h3>
                        
                        <div className="flex gap-4 items-center">
                          {/* Mini vertical stacked bar */}
                          <div className="flex h-36 w-8 flex-col overflow-hidden rounded bg-slate-100 border border-slate-200/50 shadow-inner flex-shrink-0">
                            {metrics.timeInVeryHigh > 0 && <div style={{ height: `${metrics.timeInVeryHigh}%` }} className="bg-[#F29100]" />}
                            {metrics.timeInHigh > 0 && <div style={{ height: `${metrics.timeInHigh}%` }} className="bg-[#FCD116]" />}
                            {metrics.timeInTarget > 0 && <div style={{ height: `${metrics.timeInTarget}%` }} className="bg-[#72B100]" />}
                            {metrics.timeInLow > 0 && <div style={{ height: `${metrics.timeInLow}%` }} className="bg-[#F04124]" />}
                            {metrics.timeInVeryLow > 0 && <div style={{ height: `${metrics.timeInVeryLow}%` }} className="bg-[#9C0006]" />}
                          </div>

                          <div className="flex-1 grid grid-cols-2 gap-y-2 gap-x-4 text-xs font-bold">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded bg-[#F29100]" />
                              <span className="text-slate-500">Very High</span>
                            </div>
                            <div className="text-right text-slate-800">{formatPctLabel(metrics.timeInVeryHigh, entries.filter(e => e.sgv > 250).length)}</div>

                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded bg-[#FCD116]" />
                              <span className="text-slate-500">High</span>
                            </div>
                            <div className="text-right text-slate-800">{formatPctLabel(metrics.timeInHigh, entries.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</div>

                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded bg-[#72B100]" />
                              <span className="text-[#527e00]">In Range</span>
                            </div>
                            <div className="text-right text-[#72B100]">{metrics.timeInTarget}%</div>

                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded bg-[#F04124]" />
                              <span className="text-slate-500">Low</span>
                            </div>
                            <div className="text-right text-slate-800">{formatPctLabel(metrics.timeInLow, entries.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</div>

                            <div className="flex items-center gap-1.5">
                              <span className="h-2.5 w-2.5 rounded bg-[#9C0006]" />
                              <span className="text-slate-500">Very Low</span>
                            </div>
                            <div className="text-right text-slate-800">{formatPctLabel(metrics.timeInVeryLow, entries.filter(e => e.sgv < 54).length)}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* AGP ECharts line */}
                  <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <AGPChart percentiles={calculateAGPPercentiles(entries, units)} units={units} />
                  </div>
                </div>
              )}

              {/* DAILY LOGS TAB */}
              {activeTab === 'daily' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="divide-y divide-slate-100">
                    {getDaysArray().map((dayDate, idx) => {
                      const start = dayDate.getTime();
                      const end = start + 24 * 60 * 60 * 1000 - 1;

                      const dayEntries = entries.filter(e => e.date >= start && e.date <= end);
                      const dayTreatments = treatments.filter(t => {
                        const date = t.date || new Date(t.created_at).getTime();
                        return date >= start && date <= end;
                      });

                      let mean = '0';
                      let inRangePercent = 0;
                      if (dayEntries.length > 0) {
                        const sum = dayEntries.reduce((acc, e) => acc + e.sgv, 0);
                        const rawMean = sum / dayEntries.length;
                        mean = units === GlucoseUnit.MMOL 
                          ? (rawMean / 18.018).toFixed(1) 
                          : Math.round(rawMean).toString();
                        const inRangeCount = dayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
                        inRangePercent = Math.round((inRangeCount / dayEntries.length) * 100);
                      }

                      const dateString = dayDate.toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'short',
                        day: 'numeric'
                      });

                      return (
                        <div key={idx} className="flex flex-col md:flex-row items-stretch py-5 gap-6">
                          <div className="w-full md:w-60 flex-shrink-0 flex flex-col justify-center text-left">
                            <h3 className="text-sm font-extrabold text-slate-900">{dateString}</h3>
                            {dayEntries.length > 0 ? (
                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-bold text-slate-500">
                                <span>Avg: <strong className="text-slate-800">{mean} {units}</strong></span>
                                <span className={inRangePercent >= 70 ? 'text-[#72B100]' : 'text-amber-600'}>
                                  {inRangePercent}% In Range
                                </span>
                              </div>
                            ) : (
                              <p className="text-xs text-slate-400 mt-1 font-semibold">No glucose data</p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">{dayEntries.length} readings</p>
                          </div>

                          <div className="flex-1 min-w-[200px] flex items-center bg-slate-50/50 rounded-lg p-2 border border-slate-100">
                            {dayEntries.length > 0 ? (
                              <DailyMiniChart
                                entries={dayEntries}
                                treatments={dayTreatments}
                                units={units}
                                dayStart={start}
                              />
                            ) : (
                              <div className="w-full py-4 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-md bg-white">
                                No glucose records logged for this day
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STATISTICS TAB */}
              {activeTab === 'stats' && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                  
                  {/* Sub-tab Selectors */}
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-4 gap-4">
                    <div>
                      <h2 className="text-lg font-bold tracking-tight text-slate-900 font-sans">Glucose & Insulin Statistics</h2>
                      <p className="text-xs text-slate-400 font-medium">Aggregated logs for {dateRangeStr}</p>
                    </div>
                    
                    <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 self-start sm:self-center">
                      <button
                        onClick={() => setStatsSubTab('daily')}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          statsSubTab === 'daily'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Daily Table
                      </button>
                      <button
                        onClick={() => setStatsSubTab('hourly')}
                        className={`rounded-md px-3.5 py-1.5 text-xs font-bold transition cursor-pointer ${
                          statsSubTab === 'hourly'
                            ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Hourly Table
                      </button>
                    </div>
                  </div>

                  {statsSubTab === 'daily' ? (
                    <DailyStatsTable
                      days={getDaysArray()}
                      entries={entries}
                      units={units}
                    />
                  ) : (
                    <HourlyStatsTable
                      entries={entries}
                      units={units}
                    />
                  )}

                </div>
              )}

              {/* CGM Sensor Active Wear details bar */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5 shrink-0">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sensor Active Wear</span>
                    <div className="mt-1 text-2xl font-extrabold text-slate-800">{wearPercentage}%</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">Goal is &gt; 70% active wear</div>
                  </div>
                  <div className="border-t border-slate-200 pt-6 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total CGM Readings</span>
                    <div className="mt-1 text-2xl font-extrabold text-slate-800">{entries.length}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-bold">Readings over {dateRangeDays} days</div>
                  </div>
                  <div className="border-t border-slate-200 pt-6 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Readings/Day</span>
                    <div className="mt-1 text-2xl font-extrabold text-slate-800">{avgReadingsPerDay}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-bold">Target is 288 readings/day</div>
                  </div>
                </div>
              </div>
              
            </div>
          ) : (
            <div className="text-center py-12 bg-white border border-slate-200 rounded-xl shadow-sm">
              <p className="text-slate-400 font-bold text-xs">No data could be processed. Please check your connection.</p>
            </div>
          )}

          {/* Dexcom EU Regulatory Footer Block */}
          <footer className="mt-8 pt-8 border-t border-slate-200/60 pb-12 text-slate-400 font-sans font-semibold text-[10px] leading-relaxed select-none shrink-0 text-left">
            <div className="flex flex-col md:flex-row gap-6 md:justify-between items-start">
              
              {/* Left Column: Logo & Copyright */}
              <div className="space-y-4">
                <a href="#" className="inline-block" onClick={(e) => e.preventDefault()}>
                  <span className="font-black text-slate-500 text-sm tracking-tight">NIGHTSCOUT LUCID</span>
                </a>
                <div>
                  <div>© 2026 Nightscout Lucid Contributors.</div>
                  <div className="mt-2 text-slate-400 font-medium">UK RP: MDSS-UK RP LIMITED</div>
                  <div className="text-slate-400/80 font-medium">Parkway House, Palatine Rd, Northenden, Manchester M22 4DB, UK</div>
                </div>
              </div>

              {/* Right Column: Policy Links and Attribution */}
              <div className="flex-1 md:max-w-2xl space-y-3 md:text-right">
                <div className="flex flex-wrap gap-x-4 gap-y-1.5 md:justify-end text-[10px] font-bold text-slate-500">
                  <a href="#" className="hover:text-slate-700 transition">Contact Us</a>
                  <a href="#" className="hover:text-slate-700 transition">Terms of Use</a>
                  <a href="#" className="hover:text-slate-700 transition">Privacy Policy</a>
                  <a href="#" className="hover:text-slate-700 transition">Safety Information</a>
                  <a href="#" className="hover:text-slate-700 transition">Uploader Software</a>
                </div>
                <p className="text-slate-400/85">
                  Dexcom and Dexcom Clarity are trademarks of Dexcom, Inc. Nightscout Lucid is an independent open-source project.
                </p>
                <div className="text-slate-400/80 font-medium">
                  Nightscout Lucid v1.0.0 • DOM 2026-06-28
                </div>
              </div>

            </div>
          </footer>

        </main>
      </div>
    </div>
  );
};
