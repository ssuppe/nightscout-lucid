import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle,
  Download,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Smartphone,
  Award,
  FileSpreadsheet
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
import { generateCSV } from '../utils/csvExport';
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

const getActiveDays = (entries: NightscoutEntry[], defaultDays: number): number => {
  if (!entries || entries.length === 0) return 1;
  let min = entries[0].date;
  let max = entries[0].date;
  for (let i = 1; i < entries.length; i++) {
    const d = entries[i].date;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return Math.min(defaultDays, Math.max(1, Math.ceil((max - min) / (1000 * 60 * 60 * 24))));
};

const tabLabels: Record<string, string> = {
  overview: 'Overview',
  patterns: 'Patterns',
  overlay: 'Overlay',
  daily: 'Daily',
  compare: 'Compare',
  stats: 'Statistics',
  agp: 'AGP',
};

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

  // Compare Page States
  const [compareSubTab, setCompareSubTab] = useState<'trends' | 'overlay' | 'daily'>('trends');
  const [compareDays, setCompareDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [compareTimeOfDay, setCompareTimeOfDay] = useState<'all' | 'daytime' | 'nighttime'>('all');
  const [compareEvent, setCompareEvent] = useState<'none' | 'lows' | 'highs'>('none');
  const [activeCompareDropdown, setActiveCompareDropdown] = useState<'days' | 'time' | 'events' | null>(null);

  // Ref to track if we were in compare mode (to avoid double-reload on non-boundary tab switches)
  const wasCompareRef = React.useRef<boolean>(false);

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

  const isCompareNow = activeTab === 'compare';

  // Filter entries to only dateRangeDays for non-compare views
  const displayEntries = React.useMemo(() => {
    if (isCompareNow) {
      return entries;
    }
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - dateRangeDays);
    limitDate.setHours(0, 0, 0, 0);
    return entries.filter(e => e.date >= limitDate.getTime());
  }, [entries, dateRangeDays, isCompareNow]);

  // Reload data when dateRangeDays changes (always load appropriate amount)
  useEffect(() => {
    const daysToLoad = isCompareNow ? dateRangeDays * 2 : dateRangeDays;
    loadData(daysToLoad);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRangeDays]);

  // Also reload when switching from non-compare to compare (need double the data)
  useEffect(() => {
    const wasCompare = wasCompareRef.current;
    wasCompareRef.current = isCompareNow;
    if (!wasCompare && isCompareNow) {
      // Switching into compare: reload with double days
      loadData(dateRangeDays * 2);
    } else if (wasCompare && !isCompareNow) {
      // Switching back from compare: reload with single period
      loadData(dateRangeDays);
    }
    // If not changing the compare boundary, don't reload
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompareNow]);

  const handleExportCSV = () => {
    const limitTime = new Date();
    limitTime.setDate(limitTime.getDate() - dateRangeDays);
    limitTime.setHours(0, 0, 0, 0);
    const limitTimestamp = limitTime.getTime();

    const filteredEntries = isCompareNow ? entries : entries.filter(e => e.date >= limitTimestamp);
    const filteredTreatments = isCompareNow ? treatments : treatments.filter(t => {
      const tTime = t.date || new Date(t.created_at).getTime();
      return tTime >= limitTimestamp;
    });

    const csvContent = generateCSV(filteredEntries, filteredTreatments, units);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    const pad = (n: number) => String(n).padStart(2, '0');
    const d = new Date();
    const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const rangeStr = isCompareNow ? 'compare' : `${dateRangeDays}d`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', `nightscout_export_${rangeStr}_${dateStr}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Recalculate metrics when preferred unit changes, without re-fetching
  useEffect(() => {
    if (displayEntries.length > 0) {
      const computed = calculateGlucoseMetrics(displayEntries, units);
      setMetrics(computed);
    }
  }, [units, displayEntries]);

  const activeSensorDays = getActiveDays(displayEntries, dateRangeDays);
  
  // Calculate distinct days containing CGM logs
  const getDaysWithDataCount = () => {
    if (displayEntries.length === 0) return 0;
    const uniqueDays = new Set(displayEntries.map(e => new Date(e.date).toDateString()));
    return Math.min(dateRangeDays, uniqueDays.size);
  };

  const avgReadingsPerDay = displayEntries.length > 0 
    ? Math.round(displayEntries.length / Math.max(activeSensorDays, 1)) 
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

    const rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - dateRangeDays + 1);
    rangeStart.setHours(0, 0, 0, 0);

    for (let i = 0; i < dateRangeDays; i += 7) {
      const weekEnd = new Date(today);
      weekEnd.setDate(today.getDate() - i);
      weekEnd.setHours(23, 59, 59, 999);

      let weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6);
      weekStart.setHours(0, 0, 0, 0);

      if (weekStart < rangeStart) {
        weekStart = new Date(rangeStart);
      }

      weeks.push({ start: weekStart, end: weekEnd });
    }
    return weeks;
  };

  const getBestDay = () => {
    if (displayEntries.length === 0) return { dateStr: '-', tir: 0 };
    const days = getDaysArray();
    let bestDayDate = days[0];
    let bestDayTIR = 0;

    days.forEach(day => {
      const start = day.getTime();
      const end = start + 24 * 60 * 60 * 1000 - 1;
      const dayEntries = displayEntries.filter(e => e.date >= start && e.date <= end);
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

  const getWeeklyCalendarRows = () => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const start = new Date(today);
    start.setDate(today.getDate() - dateRangeDays + 1);
    start.setHours(0, 0, 0, 0);

    const weeks: Date[][] = [];
    
    // Find the Monday of the week containing 'start'
    const firstMonday = new Date(start);
    const day = firstMonday.getDay();
    const diff = firstMonday.getDate() - day + (day === 0 ? -6 : 1);
    firstMonday.setDate(diff);
    firstMonday.setHours(0, 0, 0, 0);

    const current = new Date(firstMonday);
    while (current <= today) {
      const weekDates = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(current);
        d.setDate(current.getDate() + i);
        weekDates.push(d);
      }
      weeks.push(weekDates);
      current.setDate(current.getDate() + 7);
    }
    return weeks;
  };

  const weekdays = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 }
  ];

  const formatPctLabel = (pct: number, count: number) => {
    if (pct === 0 && count > 0) return '<1%';
    return `${pct}%`;
  };

  const renderBarSegment = (pct: number, count: number, className: string) => {
    if (pct === 0 && count === 0) return null;
    const height = pct === 0 && count > 0 ? '1%' : `${pct}%`;
    return <div style={{ height }} className={className} />;
  };

  const latestUploadDateStr = displayEntries.length > 0 
    ? new Date(displayEntries[0].date).toLocaleDateString(undefined, {
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

            {/* Disconnect Button */}
            <button
              onClick={onDisconnect}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50/50 rounded-md transition cursor-pointer"
            >
              Disconnect
            </button>
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
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {tabLabels[activeTab] || activeTab}
              </h1>

              {/* Mobile page selector dropdown */}
              <div className="md:hidden">
                <select
                  value={activeTab}
                  onChange={(e) => setActiveTab(e.target.value as any)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#72B100]/25 focus:border-[#72B100] cursor-pointer shadow-sm"
                >
                  <option value="overview">Overview</option>
                  <option value="patterns">Patterns</option>
                  <option value="overlay">Overlay</option>
                  <option value="daily">Daily</option>
                  <option value="compare">Compare</option>
                  <option value="stats">Statistics</option>
                  <option value="agp">AGP</option>
                </select>
              </div>
              
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
                <button className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" title="Download PDF">
                  <Download className="h-4 w-4" />
                </button>
                <button 
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition cursor-pointer" 
                  title="Export CSV"
                  onClick={handleExportCSV}
                >
                  <FileSpreadsheet className="h-4 w-4" />
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
                            {renderBarSegment(metrics.timeInVeryHigh, displayEntries.filter(e => e.sgv > 250).length, "bg-[#F29100]")}
                            {renderBarSegment(metrics.timeInHigh, displayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length, "bg-[#FCD116]")}
                            {renderBarSegment(metrics.timeInTarget, displayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length, "bg-[#72B100]")}
                            {renderBarSegment(metrics.timeInLow, displayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length, "bg-[#F04124]")}
                            {renderBarSegment(metrics.timeInVeryLow, displayEntries.filter(e => e.sgv < 54).length, "bg-[#9C0006]")}
                          </div>

                          {/* Legends list */}
                          <div className="flex-1 flex flex-col justify-between py-0.5 text-[11px] font-bold text-slate-500 space-y-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#F29100]" />
                                <span>Very high</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInVeryHigh, displayEntries.filter(e => e.sgv > 250).length)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#FCD116]" />
                                <span>High</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInHigh, displayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</span>
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
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInLow, displayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</span>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full bg-[#9C0006]" />
                                <span>Very low</span>
                              </div>
                              <span className="text-slate-800">{formatPctLabel(metrics.timeInVeryLow, displayEntries.filter(e => e.sgv < 54).length)}</span>
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
                      hourlyStats={calculate15MinGlucoseStats(displayEntries, units)} 
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
                          <h4 className="text-sm font-extrabold text-slate-800">Best glucose day</h4>
                          <p className="text-xs text-slate-500 mt-0.5 font-bold">
                            Glucose data was in the target range about {bestDayInfo.tir}% of the day.
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
                        <h4 className="text-sm font-extrabold text-slate-800">Best glucose day</h4>
                        <p className="text-xs text-slate-500 mt-1 font-bold">
                          Glucose data was in the target range about {bestDayInfo.tir}% of the day.
                        </p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-300" />
                  </div>
                </div>
              )}

              {/* COMPARE TAB CONTENT */}
              {activeTab === 'compare' && (() => {
                // Prepare date ranges
                const toA = new Date();
                toA.setHours(23, 59, 59, 999);
                const fromA = new Date();
                fromA.setDate(toA.getDate() - dateRangeDays + 1);
                fromA.setHours(0, 0, 0, 0);

                const toB = new Date(fromA);
                toB.setDate(fromA.getDate() - 1);
                toB.setHours(23, 59, 59, 999);
                const fromB = new Date(toB);
                fromB.setDate(toB.getDate() - dateRangeDays + 1);
                fromB.setHours(0, 0, 0, 0);

                const formatDate = (d: Date) => d.toLocaleDateString(undefined, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric'
                });

                const labelA = `${formatDate(fromA)} - ${formatDate(toA)}`;
                const labelB = `${formatDate(fromB)} - ${formatDate(toB)}`;

                // Filter entries for Range A and B
                let rawEntriesA = entries.filter(e => e.date >= fromA.getTime() && e.date <= toA.getTime());
                let rawEntriesB = entries.filter(e => e.date >= fromB.getTime() && e.date <= toB.getTime());

                // Apply weekday filters
                rawEntriesA = rawEntriesA.filter(e => compareDays.includes(new Date(e.date).getDay()));
                rawEntriesB = rawEntriesB.filter(e => compareDays.includes(new Date(e.date).getDay()));

                // Apply time of day filters
                if (compareTimeOfDay === 'daytime') {
                  const filterDaytime = (e: NightscoutEntry) => {
                    const hr = new Date(e.date).getHours();
                    return hr >= 7 && hr < 22;
                  };
                  rawEntriesA = rawEntriesA.filter(filterDaytime);
                  rawEntriesB = rawEntriesB.filter(filterDaytime);
                } else if (compareTimeOfDay === 'nighttime') {
                  const filterNighttime = (e: NightscoutEntry) => {
                    const hr = new Date(e.date).getHours();
                    return hr < 7 || hr >= 22;
                  };
                  rawEntriesA = rawEntriesA.filter(filterNighttime);
                  rawEntriesB = rawEntriesB.filter(filterNighttime);
                }

                // Apply event filters
                if (compareEvent !== 'none') {
                  const getDaysWithEvent = (entriesList: NightscoutEntry[]) => {
                    const setOfDays = new Set<string>();
                    entriesList.forEach(e => {
                      const dStr = new Date(e.date).toDateString();
                      if (compareEvent === 'lows' && e.sgv < 70) {
                        setOfDays.add(dStr);
                      } else if (compareEvent === 'highs' && e.sgv > 180) {
                        setOfDays.add(dStr);
                      }
                    });
                    return setOfDays;
                  };

                  const daysA = getDaysWithEvent(rawEntriesA);
                  const daysB = getDaysWithEvent(rawEntriesB);

                  rawEntriesA = rawEntriesA.filter(e => daysA.has(new Date(e.date).toDateString()));
                  rawEntriesB = rawEntriesB.filter(e => daysB.has(new Date(e.date).toDateString()));
                }

                const metricsA = calculateGlucoseMetrics(rawEntriesA, units);
                const metricsB = calculateGlucoseMetrics(rawEntriesB, units);

                const activeDaysA = getActiveDays(rawEntriesA, dateRangeDays);
                const activeDaysB = getActiveDays(rawEntriesB, dateRangeDays);

                const wearPctA = Math.min(100, Math.round(((rawEntriesA.length / Math.max(activeDaysA, 1)) / 288) * 100));
                const wearPctB = Math.min(100, Math.round(((rawEntriesB.length / Math.max(activeDaysB, 1)) / 288) * 100));

                const getWeeksArrayForRange = (endLimit: Date) => {
                  const weeks = [];
                  const baseEnd = new Date(endLimit);
                  baseEnd.setHours(23, 59, 59, 999);

                  const rangeStart = new Date(baseEnd);
                  rangeStart.setDate(baseEnd.getDate() - dateRangeDays + 1);
                  rangeStart.setHours(0, 0, 0, 0);

                  for (let i = 0; i < dateRangeDays; i += 7) {
                    const weekEnd = new Date(baseEnd);
                    weekEnd.setDate(baseEnd.getDate() - i);
                    weekEnd.setHours(23, 59, 59, 999);

                    let weekStart = new Date(weekEnd);
                    weekStart.setDate(weekEnd.getDate() - 6);
                    weekStart.setHours(0, 0, 0, 0);

                    if (weekStart < rangeStart) {
                      weekStart = new Date(rangeStart);
                    }

                    weeks.push({ start: weekStart, end: weekEnd });
                  }
                  return weeks;
                };

                const getDaysArrayForRange = (startDate: Date, numDays: number) => {
                  const arr = [];
                  for (let i = 0; i < numDays; i++) {
                    const d = new Date(startDate);
                    d.setDate(startDate.getDate() + i);
                    d.setHours(0, 0, 0, 0);
                    arr.push(d);
                  }
                  return arr;
                };

                return (
                  <div className="space-y-6 text-left" data-testid="compare-page-content">
                    {/* Top Action controls bar */}
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                      <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 shadow-sm">
                        {[
                          { id: 'trends', label: 'Trends' },
                          { id: 'overlay', label: 'Overlay' },
                          { id: 'daily', label: 'Daily' }
                        ].map(tab => (
                          <button
                            key={tab.id}
                            onClick={() => setCompareSubTab(tab.id as any)}
                            className={`px-4 py-1.5 text-xs font-black rounded-md transition cursor-pointer ${
                              compareSubTab === tab.id
                                ? 'bg-white text-slate-800 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            {tab.label}
                          </button>
                        ))}
                      </div>

                      {/* Dropdown Filters */}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {/* Days Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveCompareDropdown(activeCompareDropdown === 'days' ? null : 'days')}
                            className="px-3.5 py-1.5 text-xs font-extrabold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Days</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {activeCompareDropdown === 'days' && (
                            <div className="absolute right-0 sm:left-0 mt-1.5 w-48 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 space-y-2.5">
                              <div className="flex flex-col gap-2">
                                {weekdays.map(d => (
                                  <label key={d.value} className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={compareDays.includes(d.value)}
                                      onChange={(e) => {
                                        if (e.target.checked) {
                                          setCompareDays([...compareDays, d.value]);
                                        } else {
                                          setCompareDays(compareDays.filter(val => val !== d.value));
                                        }
                                      }}
                                      className="rounded text-[#72B100] focus:ring-[#72B100]"
                                    />
                                    <span>{d.label}s</span>
                                  </label>
                                ))}
                              </div>
                              <div className="border-t border-slate-100 pt-2 flex justify-between gap-2">
                                <button
                                  onClick={() => setCompareDays([0, 1, 2, 3, 4, 5, 6])}
                                  className="text-[10px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                                >
                                  Select All
                                </button>
                                <button
                                  onClick={() => setActiveCompareDropdown(null)}
                                  className="text-[10px] font-black text-[#72B100] hover:text-[#527e00] cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Time of Day Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveCompareDropdown(activeCompareDropdown === 'time' ? null : 'time')}
                            className="px-3.5 py-1.5 text-xs font-extrabold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Time of Day</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {activeCompareDropdown === 'time' && (
                            <div className="absolute right-0 sm:left-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 space-y-2.5">
                              <div className="flex flex-col gap-2.5">
                                {[
                                  { id: 'all', label: 'All Day' },
                                  { id: 'daytime', label: 'Daytime (07:00-22:00)' },
                                  { id: 'nighttime', label: 'Nighttime (22:00-07:00)' }
                                ].map(t => (
                                  <label key={t.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="compareTimeRadio"
                                      checked={compareTimeOfDay === t.id}
                                      onChange={() => setCompareTimeOfDay(t.id as any)}
                                      className="text-[#72B100] focus:ring-[#72B100]"
                                    />
                                    <span>{t.label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="border-t border-slate-100 pt-2 text-right">
                                <button
                                  onClick={() => setActiveCompareDropdown(null)}
                                  className="text-[10px] font-black text-[#72B100] hover:text-[#527e00] cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Events Dropdown */}
                        <div className="relative">
                          <button
                            onClick={() => setActiveCompareDropdown(activeCompareDropdown === 'events' ? null : 'events')}
                            className="px-3.5 py-1.5 text-xs font-extrabold border border-slate-200 rounded-lg bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 cursor-pointer shadow-sm"
                          >
                            <span>Events</span>
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                          {activeCompareDropdown === 'events' && (
                            <div className="absolute right-0 mt-1.5 w-40 bg-white border border-slate-200 rounded-lg shadow-lg p-3 z-50 space-y-2.5">
                              <div className="flex flex-col gap-2.5">
                                {[
                                  { id: 'none', label: 'None' },
                                  { id: 'lows', label: 'Lows (< 70)' },
                                  { id: 'highs', label: 'Highs (> 180)' }
                                ].map(ev => (
                                  <label key={ev.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                                    <input
                                      type="radio"
                                      name="compareEventRadio"
                                      checked={compareEvent === ev.id}
                                      onChange={() => setCompareEvent(ev.id as any)}
                                      className="text-[#72B100] focus:ring-[#72B100]"
                                    />
                                    <span>{ev.label}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="border-t border-slate-100 pt-2 text-right">
                                <button
                                  onClick={() => setActiveCompareDropdown(null)}
                                  className="text-[10px] font-black text-[#72B100] hover:text-[#527e00] cursor-pointer"
                                >
                                  Apply
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Active Filters Display Tag Bar */}
                    {(compareDays.length < 7 || compareTimeOfDay !== 'all' || compareEvent !== 'none') && (
                      <div className="flex items-center gap-2 bg-[#72B100]/5 border border-[#72B100]/10 rounded-xl px-4 py-2 text-xs text-slate-600 font-semibold shadow-sm">
                        <button
                          onClick={() => {
                            setCompareDays([0, 1, 2, 3, 4, 5, 6]);
                            setCompareTimeOfDay('all');
                            setCompareEvent('none');
                          }}
                          className="text-[#9C0006] hover:text-red-700 cursor-pointer mr-1 font-bold"
                          title="Clear all filters"
                        >
                          ✕
                        </button>
                        <span className="font-bold text-slate-700">Filtered by:</span>
                        {compareDays.length < 7 && (
                          <span className="bg-white px-2 py-0.5 border border-slate-200 rounded">
                            {compareDays.length} Days ({compareDays.map(d => weekdays.find(w => w.value === d)?.label).join(', ')})
                          </span>
                        )}
                        {compareTimeOfDay !== 'all' && (
                          <span className="bg-white px-2 py-0.5 border border-slate-200 rounded uppercase">
                            Time: {compareTimeOfDay}
                          </span>
                        )}
                        {compareEvent !== 'none' && (
                          <span className="bg-white px-2 py-0.5 border border-slate-200 rounded uppercase">
                            Events: {compareEvent}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Side-by-Side Comparison Columns */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                      
                      {/* Left Column - Range B (Past / Reference Range) */}
                      <div className="space-y-6">
                        <div className="bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 shadow-inner text-center">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-0.5">Reference Period</span>
                          <span className="text-sm font-extrabold text-slate-800">{labelB}</span>
                        </div>

                        {/* Trends sub-tab: AGP + Summary */}
                        {compareSubTab === 'trends' && (
                          <div className="space-y-6">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 text-center">Modal Day (AGP Profile)</h4>
                              <AGPChart percentiles={calculateAGPPercentiles(rawEntriesB, units)} units={units} />
                            </div>

                            {/* Summary stats block */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                              {/* TIR */}
                              <div className="md:col-span-7 border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
                                <div>
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Time in Ranges</h5>
                                  <div className="flex gap-4 items-center">
                                    <div className="flex h-32 w-8 flex-col overflow-hidden rounded-[3px] bg-slate-100 border border-slate-200/50 shadow-inner shrink-0">
                                      {renderBarSegment(metricsB.timeInVeryHigh, rawEntriesB.filter(e => e.sgv > 250).length, "bg-[#F29100]")}
                                      {renderBarSegment(metricsB.timeInHigh, rawEntriesB.filter(e => e.sgv > 180 && e.sgv <= 250).length, "bg-[#FCD116]")}
                                      {renderBarSegment(metricsB.timeInTarget, rawEntriesB.filter(e => e.sgv >= 70 && e.sgv <= 180).length, "bg-[#72B100]")}
                                      {renderBarSegment(metricsB.timeInLow, rawEntriesB.filter(e => e.sgv >= 54 && e.sgv < 70).length, "bg-[#F04124]")}
                                      {renderBarSegment(metricsB.timeInVeryLow, rawEntriesB.filter(e => e.sgv < 54).length, "bg-[#9C0006]")}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-0.5 text-[10px] font-bold text-slate-500 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#F29100]" />
                                          <span>Very High</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsB.timeInVeryHigh, rawEntriesB.filter(e => e.sgv > 250).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#FCD116]" />
                                          <span>High</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsB.timeInHigh, rawEntriesB.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between py-0.5 bg-[#72B100]/5 px-1.5 rounded">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#72B100]" />
                                          <span className="text-[#527e00]">In Target</span>
                                        </div>
                                        <span className="text-[#72B100] font-black">{metricsB.timeInTarget}%</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#F04124]" />
                                          <span>Low</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsB.timeInLow, rawEntriesB.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#9C0006]" />
                                          <span>Very Low</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsB.timeInVeryLow, rawEntriesB.filter(e => e.sgv < 54).length)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Stats table */}
                              <div className="md:col-span-5 border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between text-xs font-bold text-slate-500">
                                <div className="space-y-2.5">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Metrics</h5>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Average</span>
                                    <span className="text-slate-800 font-black">
                                      {metricsB.readingCount > 0 
                                        ? `${isMgdl ? metricsB.mean.toFixed(0) : metricsB.mean.toFixed(1)} ${units}`
                                        : '-'
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>GMI</span>
                                    <span className="text-slate-800 font-black">{metricsB.readingCount > 0 ? `${metricsB.gmi}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Variability (CV)</span>
                                    <span className="text-slate-800 font-black">{metricsB.readingCount > 0 ? `${metricsB.cv}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>CGM Active</span>
                                    <span className="text-slate-800 font-black">{metricsB.readingCount > 0 ? `${wearPctB}%` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Overlay sub-tab */}
                        {compareSubTab === 'overlay' && (
                          <div className="space-y-4">
                            {getWeeksArrayForRange(toB).map((week, idx) => {
                              const weekEntries = rawEntriesB.filter(
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
                                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                  <WeeklyOverlayChart
                                    entries={weekEntries}
                                    units={units}
                                    selectedDays={compareDays}
                                    eventFilter={compareEvent === 'highs' ? 'highs' : compareEvent === 'lows' ? 'lows' : 'all'}
                                    weekLabel={weekLabel}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Daily sub-tab */}
                        {compareSubTab === 'daily' && (
                          <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            {getDaysArrayForRange(fromB, dateRangeDays).reverse().map((dayDate, idx) => {
                              const start = dayDate.getTime();
                              const end = start + 24 * 60 * 60 * 1000 - 1;
                              const dayEntries = rawEntriesB.filter(e => e.date >= start && e.date <= end);
                              const dayTreatments = treatments.filter(t => {
                                const date = t.date || new Date(t.created_at).getTime();
                                return date >= start && date <= end;
                              });

                              const dateString = dayDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              });

                              return (
                                <div key={idx} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-4">
                                  <div className="w-28 shrink-0 text-left">
                                    <span className="text-xs font-black text-slate-800">{dateString}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">{dayEntries.length} logs</span>
                                  </div>
                                  <div className="flex-1 min-w-0 h-14 flex items-center">
                                    {dayEntries.length > 0 ? (
                                      <DailyMiniChart
                                        entries={dayEntries}
                                        treatments={dayTreatments}
                                        units={units}
                                        dayStart={start}
                                      />
                                    ) : (
                                      <span className="text-[10px] italic text-slate-300">No logs</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Right Column - Range A (Recent / Comparison Target Range) */}
                      <div className="space-y-6">
                        <div className="bg-[#72B100]/5 border border-[#72B100]/20 rounded-xl px-4 py-3 shadow-inner text-center">
                          <span className="text-[10px] font-black text-[#72B100] uppercase tracking-wider block mb-0.5">Comparison Period</span>
                          <span className="text-sm font-extrabold text-[#72B100]">{labelA}</span>
                        </div>

                        {/* Trends sub-tab: AGP + Summary */}
                        {compareSubTab === 'trends' && (
                          <div className="space-y-6">
                            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                              <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4 text-center">Modal Day (AGP Profile)</h4>
                              <AGPChart percentiles={calculateAGPPercentiles(rawEntriesA, units)} units={units} />
                            </div>

                            {/* Summary stats block */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                              {/* TIR */}
                              <div className="md:col-span-7 border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between">
                                <div>
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-3">Time in Ranges</h5>
                                  <div className="flex gap-4 items-center">
                                    <div className="flex h-32 w-8 flex-col overflow-hidden rounded-[3px] bg-slate-100 border border-slate-200/50 shadow-inner shrink-0">
                                      {renderBarSegment(metricsA.timeInVeryHigh, rawEntriesA.filter(e => e.sgv > 250).length, "bg-[#F29100]")}
                                      {renderBarSegment(metricsA.timeInHigh, rawEntriesA.filter(e => e.sgv > 180 && e.sgv <= 250).length, "bg-[#FCD116]")}
                                      {renderBarSegment(metricsA.timeInTarget, rawEntriesA.filter(e => e.sgv >= 70 && e.sgv <= 180).length, "bg-[#72B100]")}
                                      {renderBarSegment(metricsA.timeInLow, rawEntriesA.filter(e => e.sgv >= 54 && e.sgv < 70).length, "bg-[#F04124]")}
                                      {renderBarSegment(metricsA.timeInVeryLow, rawEntriesA.filter(e => e.sgv < 54).length, "bg-[#9C0006]")}
                                    </div>
                                    <div className="flex-1 flex flex-col justify-between py-0.5 text-[10px] font-bold text-slate-500 space-y-1">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#F29100]" />
                                          <span>Very High</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsA.timeInVeryHigh, rawEntriesA.filter(e => e.sgv > 250).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#FCD116]" />
                                          <span>High</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsA.timeInHigh, rawEntriesA.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between py-0.5 bg-[#72B100]/5 px-1.5 rounded">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#72B100]" />
                                          <span className="text-[#527e00]">In Target</span>
                                        </div>
                                        <span className="text-[#72B100] font-black">{metricsA.timeInTarget}%</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#F04124]" />
                                          <span>Low</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsA.timeInLow, rawEntriesA.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</span>
                                      </div>
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-2 h-2 rounded bg-[#9C0006]" />
                                          <span>Very Low</span>
                                        </div>
                                        <span className="text-slate-800 font-black">{formatPctLabel(metricsA.timeInVeryLow, rawEntriesA.filter(e => e.sgv < 54).length)}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Stats table */}
                              <div className="md:col-span-5 border border-slate-200 rounded-xl p-5 bg-white shadow-sm flex flex-col justify-between text-xs font-bold text-slate-500">
                                <div className="space-y-2.5">
                                  <h5 className="text-[10px] font-black text-slate-400 uppercase tracking-wider mb-2">Metrics</h5>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Average</span>
                                    <span className="text-slate-800 font-black">
                                      {metricsA.readingCount > 0 
                                        ? `${isMgdl ? metricsA.mean.toFixed(0) : metricsA.mean.toFixed(1)} ${units}`
                                        : '-'
                                      }
                                    </span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>GMI</span>
                                    <span className="text-slate-800 font-black">{metricsA.readingCount > 0 ? `${metricsA.gmi}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between border-b border-slate-100 pb-1.5">
                                    <span>Variability (CV)</span>
                                    <span className="text-slate-800 font-black">{metricsA.readingCount > 0 ? `${metricsA.cv}%` : '-'}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>CGM Active</span>
                                    <span className="text-slate-800 font-black">{metricsA.readingCount > 0 ? `${wearPctA}%` : '-'}</span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Overlay sub-tab */}
                        {compareSubTab === 'overlay' && (
                          <div className="space-y-4">
                            {getWeeksArrayForRange(toA).map((week, idx) => {
                              const weekEntries = rawEntriesA.filter(
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
                                <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                  <WeeklyOverlayChart
                                    entries={weekEntries}
                                    units={units}
                                    selectedDays={compareDays}
                                    eventFilter={compareEvent === 'highs' ? 'highs' : compareEvent === 'lows' ? 'lows' : 'all'}
                                    weekLabel={weekLabel}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Daily sub-tab */}
                        {compareSubTab === 'daily' && (
                          <div className="space-y-4 bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                            {getDaysArrayForRange(fromA, dateRangeDays).reverse().map((dayDate, idx) => {
                              const start = dayDate.getTime();
                              const end = start + 24 * 60 * 60 * 1000 - 1;
                              const dayEntries = rawEntriesA.filter(e => e.date >= start && e.date <= end);
                              const dayTreatments = treatments.filter(t => {
                                const date = t.date || new Date(t.created_at).getTime();
                                return date >= start && date <= end;
                              });

                              const dateString = dayDate.toLocaleDateString(undefined, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric'
                              });

                              return (
                                <div key={idx} className="border border-slate-100 rounded-lg p-3 flex items-center justify-between gap-4">
                                  <div className="w-28 shrink-0 text-left">
                                    <span className="text-xs font-black text-slate-800">{dateString}</span>
                                    <span className="text-[10px] text-slate-400 block mt-0.5">{dayEntries.length} logs</span>
                                  </div>
                                  <div className="flex-1 min-w-0 h-14 flex items-center">
                                    {dayEntries.length > 0 ? (
                                      <DailyMiniChart
                                        entries={dayEntries}
                                        treatments={dayTreatments}
                                        units={units}
                                        dayStart={start}
                                      />
                                    ) : (
                                      <span className="text-[10px] italic text-slate-300">No logs</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })()}

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
                      const weekEntries = displayEntries.filter(
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
                <div className="bg-white border border-slate-200 shadow-sm p-8 rounded-xl max-w-5xl mx-auto space-y-8 text-left font-sans">
                  
                  {/* AGP Report Header */}
                  <div className="border-b-2 border-slate-200 pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[#72B100] font-black text-2xl tracking-tight uppercase">Nightscout</span>
                      <span className="text-slate-300 font-light text-2xl">|</span>
                      <span className="text-[#004B87] font-black text-lg tracking-tight">AGP Report</span>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Report Period</div>
                      <div className="text-xs font-black text-slate-700 mt-0.5">{dateRangeStr}</div>
                    </div>
                  </div>

                  {/* Summary Block: Time in Ranges and Glucose Metrics */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-stretch">
                    
                    {/* Left Box: Time in Ranges */}
                    <div className="md:col-span-7 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/20">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Time in Ranges</h4>
                          <span className="text-[9px] text-slate-400 font-bold">Goals for Type 1 and Type 2 Diabetes</span>
                        </div>
                        <p className="text-[9px] text-[#72B100] font-bold mb-4">Each 5% increase in Time in Target is clinically beneficial</p>
                        
                        <div className="flex gap-5 items-center">
                          {/* Vertical bar */}
                          <div className="flex h-36 w-10 flex-col overflow-hidden rounded-[3px] bg-slate-100 border border-slate-200/50 shadow-inner shrink-0">
                            {renderBarSegment(metrics.timeInVeryHigh, displayEntries.filter(e => e.sgv > 250).length, "bg-[#F29100]")}
                            {renderBarSegment(metrics.timeInHigh, displayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length, "bg-[#FCD116]")}
                            {renderBarSegment(metrics.timeInTarget, displayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length, "bg-[#72B100]")}
                            {renderBarSegment(metrics.timeInLow, displayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length, "bg-[#F04124]")}
                            {renderBarSegment(metrics.timeInVeryLow, displayEntries.filter(e => e.sgv < 54).length, "bg-[#9C0006]")}
                          </div>

                          {/* Legends list */}
                          <div className="flex-1 flex flex-col justify-between py-1 text-[11px] font-bold text-slate-500 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-[#F29100]" />
                                <span>Very High</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-800 font-black">{formatPctLabel(metrics.timeInVeryHigh, displayEntries.filter(e => e.sgv > 250).length)}</span>
                                <span className="text-slate-400 text-[10px] w-14 text-right">Goal &lt; 5%</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-[#FCD116]" />
                                <span>High</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-800 font-black">{formatPctLabel(metrics.timeInHigh, displayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length)}</span>
                                <span className="text-slate-400 text-[10px] w-14 text-right">-</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between py-1 bg-[#72B100]/5 px-2 rounded">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-[#72B100]" />
                                <span className="text-[#527e00]">In Target</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-[#72B100] font-black">{metrics.timeInTarget}%</span>
                                <span className="text-[#72B100]/80 text-[10px] w-14 text-right font-black">Goal &gt; 70%</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-[#F04124]" />
                                <span>Low</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-800 font-black">{formatPctLabel(metrics.timeInLow, displayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length)}</span>
                                <span className="text-slate-400 text-[10px] w-14 text-right">Goal &lt; 4%</span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="w-2.5 h-2.5 rounded bg-[#9C0006]" />
                                <span>Very Low</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-slate-800 font-black">{formatPctLabel(metrics.timeInVeryLow, displayEntries.filter(e => e.sgv < 54).length)}</span>
                                <span className="text-slate-400 text-[10px] w-14 text-right">Goal &lt; 1%</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-[10px] font-bold text-slate-400">
                        <span>Target: {isMgdl ? '70-180 mg/dL' : '3.9-10.0 mmol/L'}</span>
                        <div className="flex gap-4">
                          <span>Above: {metrics.timeInVeryHigh + metrics.timeInHigh}%</span>
                          <span>Below: {metrics.timeInVeryLow + metrics.timeInLow}%</span>
                        </div>
                      </div>
                    </div>

                    {/* Right Box: Glucose Metrics */}
                    <div className="md:col-span-5 border border-slate-200 rounded-xl p-5 flex flex-col justify-between bg-slate-50/20">
                      <div>
                        <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-4">Glucose Metrics</h4>
                        <table className="w-full text-xs font-bold text-slate-600">
                          <tbody>
                            <tr className="border-b border-slate-100">
                              <td className="py-2.5 text-slate-400">Average glucose</td>
                              <td className="py-2.5 text-slate-800 font-black text-right">{formattedMean} {units}</td>
                              <td className="py-2.5 text-slate-400 text-[9px] text-right pl-3">Goal &lt; {isMgdl ? '154 mg/dL' : '8.5 mmol/L'}</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-2.5 text-slate-400">GMI</td>
                              <td className="py-2.5 text-slate-800 font-black text-right">{metrics.gmi}%</td>
                              <td className="py-2.5 text-slate-400 text-[9px] text-right pl-3">Goal &lt; 7.0%</td>
                            </tr>
                            <tr className="border-b border-slate-100">
                              <td className="py-2.5 text-slate-400">Glucose Variability (CV)</td>
                              <td className="py-2.5 text-slate-800 font-black text-right">{metrics.cv}%</td>
                              <td className="py-2.5 text-slate-400 text-[9px] text-right pl-3">Goal &le; 36%</td>
                            </tr>
                            <tr>
                              <td className="py-2.5 text-slate-400">Time CGM Active</td>
                              <td className="py-2.5 text-slate-800 font-black text-right" colSpan={2}>{wearPercentage}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div className="mt-4 text-[9px] text-slate-400 leading-normal font-semibold">
                        GMI (Glucose Management Indicator) estimates laboratory HbA1c based on average sensor values.
                      </div>
                    </div>

                  </div>

                  {/* AGP ECharts Chart Wrapper */}
                  <div className="border border-slate-200 rounded-xl p-6 bg-slate-50/5">
                    <AGPChart percentiles={calculateAGPPercentiles(displayEntries, units)} units={units} />
                  </div>

                  {/* Daily Glucose Profile — Dexcom-style table layout */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                    {/* Section header */}
                    <div className="px-6 pt-5 pb-3 border-b border-slate-100">
                      <h3 className="text-sm font-extrabold text-slate-800">Daily Glucose Profile</h3>
                      <p className="text-xs text-slate-400 font-semibold mt-0.5">Each daily profile represents a midnight-to-midnight period.</p>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                        <thead>
                          <tr>
                            {/* Empty corner cell */}
                            <th style={{ width: '44px' }} className="border-0 p-0" />
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                              <th key={day} className="border-0 p-0 pb-1 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                {day}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {getWeeklyCalendarRows().map((weekRow, wIdx) => (
                            <React.Fragment key={wIdx}>
                              {/* Chart row */}
                              <tr>
                                {/* Rotated unit label */}
                                <td className="border-0 p-0 relative" style={{ width: '44px', height: '72px' }}>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <span
                                      className="text-[9px] font-black text-slate-400 uppercase tracking-widest"
                                      style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', whiteSpace: 'nowrap' }}
                                    >
                                      {units === GlucoseUnit.MMOL ? 'mmol/L' : 'mg/dL'}
                                    </span>
                                  </div>
                                </td>

                                {weekRow.map((cellDate, dIdx) => {
                                  const dateStr = cellDate.toDateString();
                                  const dayEntries = displayEntries.filter(e => new Date(e.date).toDateString() === dateStr);
                                  const dayTreatments = treatments.filter(t => {
                                    const date = t.date || new Date(t.created_at).getTime();
                                    return new Date(date).toDateString() === dateStr;
                                  });
                                  const displayDayNum = cellDate.getDate();

                                  return (
                                    <td
                                      key={dIdx}
                                      className="border-0 p-0 relative"
                                      style={{ height: '72px', borderLeft: dIdx === 0 ? '1px solid #e2e8f0' : '1px solid #f1f5f9' }}
                                    >
                                      {/* Day-of-month label overlay */}
                                      <span className="absolute top-0.5 left-1 text-[8px] font-black text-slate-500 z-10 leading-none">
                                        {displayDayNum}
                                      </span>

                                      {dayEntries.length > 0 ? (
                                        <DailyMiniChart
                                          entries={dayEntries}
                                          treatments={dayTreatments}
                                          units={units}
                                          dayStart={cellDate.getTime()}
                                          compact
                                        />
                                      ) : (
                                        <div className="absolute inset-0 flex items-center justify-center bg-slate-50/60">
                                          <span className="text-[8px] text-slate-300 italic font-semibold">—</span>
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>

                              {/* X-axis label row (noon marker) */}
                              <tr>
                                <td className="border-0 p-0" />
                                {weekRow.map((_, dIdx) => (
                                  <td
                                    key={dIdx}
                                    className="border-0 p-0 text-center"
                                    style={{ borderLeft: dIdx === 0 ? '1px solid #e2e8f0' : '1px solid #f1f5f9' }}
                                  >
                                    <span className="text-[8px] text-slate-300 font-bold">12:00</span>
                                  </td>
                                ))}
                              </tr>
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* AGP License/Copyright footer */}
                  <div className="pt-4 border-t border-slate-200 text-center text-[9px] text-slate-400 font-bold">
                    Patent pending - HealthPartners Institute dba International Diabetes Center - All Rights Reserved. ©2026 Nightscout Lucid
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

                      const dayEntries = displayEntries.filter(e => e.date >= start && e.date <= end);
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
                      entries={displayEntries}
                      units={units}
                    />
                  ) : (
                    <HourlyStatsTable
                      entries={displayEntries}
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
                    <div className="mt-1 text-2xl font-extrabold text-slate-800">{displayEntries.length}</div>
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

          {/* Open Source Footer Block */}
          <footer className="mt-8 pt-8 border-t border-slate-200/60 pb-12 text-slate-400 font-sans font-semibold text-[10px] leading-relaxed select-none shrink-0 text-left">
            <div className="flex flex-col md:flex-row gap-6 md:justify-between items-start md:items-center">
              
              {/* Left Column: Logo & License */}
              <div className="space-y-2">
                <div className="font-black text-slate-500 text-sm tracking-tight">NIGHTSCOUT LUCID</div>
                <div>
                  <div>© 2026 Nightscout Lucid Contributors.</div>
                  <div className="text-slate-400/80 font-medium mt-1">
                    Released under the <a href="https://github.com/ssuppe/nightscout-lucid/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-slate-700 underline decoration-dotted">GNU AGPLv3 License</a>.
                  </div>
                </div>
              </div>

              {/* Right Column: GitHub Repository Link & Version */}
              <div className="space-y-1 md:text-right">
                <div className="font-bold text-slate-500">
                  <a href="https://github.com/ssuppe/nightscout-lucid" target="_blank" rel="noopener noreferrer" className="hover:text-slate-700 transition inline-flex items-center gap-1 md:justify-end">
                    <svg className="h-3.5 w-3.5 fill-current" viewBox="0 0 24 24">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.603-3.369-1.34-3.369-1.34-.454-1.156-1.11-1.464-1.11-1.464-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.579.688.481C19.137 20.162 22 16.418 22 12c0-5.523-4.527-10-10-10z" />
                    </svg>
                    GitHub Repository
                  </a>
                </div>
                <div className="text-slate-400/80 font-medium">
                  Nightscout Lucid v1.0.0
                </div>
              </div>

            </div>
          </footer>

        </main>
      </div>
    </div>
  );
};
