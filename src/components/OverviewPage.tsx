import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  LogOut, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  Calendar,
  AlertTriangle
} from 'lucide-react';
import { NightscoutClient, GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry, NightscoutTreatment } from '../utils/nightscout';
import { 
  calculateGlucoseMetrics, 
  calculateAGPPercentiles, 
  calculateHourlyTIR,
  calculate15MinGlucoseStats
} from '../utils/metrics';
import type { GlucoseMetrics } from '../utils/metrics';
import { AGPChart } from './AGPChart';
import { HourlyTIRChart } from './HourlyTIRChart';
import { HourlyGlucoseChart } from './HourlyGlucoseChart';
import { DailyMiniChart } from './DailyMiniChart';

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
  const [activeTab, setActiveTab] = useState<'overview' | 'agp' | 'daily'>('overview');
  const [dateRangeDays, setDateRangeDays] = useState<number>(14);
  const [units, setUnits] = useState<GlucoseUnit>(preferredUnits);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  const [entries, setEntries] = useState<NightscoutEntry[]>([]);
  const [treatments, setTreatments] = useState<NightscoutTreatment[]>([]);
  const [metrics, setMetrics] = useState<GlucoseMetrics | null>(null);
  const [dateRangeStr, setDateRangeStr] = useState<string>('');

  const loadData = async (days: number) => {
    setLoading(true);
    setError(null);

    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - days);

    const formatDate = (d: Date) => d.toLocaleDateString(undefined, { 
      month: 'short', 
      day: 'numeric', 
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
        setTreatments(fetchedTreatments);
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

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800 font-sans antialiased font-medium">
      
      {/* Top Accent Strip - Clarity Green */}
      <div className="h-1.5 w-full bg-[#72B100]" />

      {/* Top Navbar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6 lg:px-8">
          
          {/* Logo & Project Title */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#72B100] text-white shadow-sm">
              <Activity className="h-5.5 w-5.5 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-extrabold tracking-tight text-lg text-slate-900">
                Nightscout Lucid
              </span>
              <span className="ml-2 rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 uppercase">
                Session only
              </span>
            </div>
          </div>

          {/* Action Menu */}
          <div className="flex items-center gap-3">
            {/* Preferred Unit Toggle */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                onClick={() => setUnits(GlucoseUnit.MGDL)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${
                  units === GlucoseUnit.MGDL 
                    ? 'bg-[#72B100] text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                mg/dL
              </button>
              <button
                onClick={() => setUnits(GlucoseUnit.MMOL)}
                className={`rounded-md px-3 py-1 text-xs font-bold transition ${
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
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-red-600 transition hover:bg-red-50 active:scale-[0.98] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Subheader (Clarity Style) */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Nav tabs */}
            <nav className="flex space-x-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`border-b-2 py-2 text-sm font-bold transition cursor-pointer ${
                  activeTab === 'overview' 
                    ? 'border-[#72B100] text-[#72B100]' 
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('agp')}
                className={`border-b-2 py-2 text-sm font-bold transition cursor-pointer ${
                  activeTab === 'agp' 
                    ? 'border-[#72B100] text-[#72B100]' 
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                AGP Profile
              </button>
              <button
                onClick={() => setActiveTab('daily')}
                className={`border-b-2 py-2 text-sm font-bold transition cursor-pointer ${
                  activeTab === 'daily' 
                    ? 'border-[#72B100] text-[#72B100]' 
                    : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                Daily Logs
              </button>
            </nav>

            {/* Date Range selectors */}
            <div className="flex items-center gap-2 self-start sm:self-center">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Range:</span>
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
                    {days} Days
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        
        {/* Error State */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-5 text-slate-800 shadow-sm">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0" />
              <div>
                <h3 className="text-sm font-bold text-red-800">Failed to sync data</h3>
                <p className="mt-1 font-mono text-xs text-slate-500">{error}</p>
                <button 
                  onClick={() => loadData(dateRangeDays)}
                  className="mt-3 rounded bg-red-100 px-3 py-1.5 text-xs font-bold text-red-800 transition hover:bg-red-200"
                >
                  Retry Fetch
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Loading / Spinner */}
        {loading ? (
          <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
            <div className="relative">
              <div className="h-12 w-12 rounded-full border-4 border-slate-200"></div>
              <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-4 border-t-[#72B100] animate-spin"></div>
            </div>
            <p className="text-sm font-bold text-slate-400 animate-pulse">Loading Nightscout data...</p>
          </div>
        ) : metrics ? (
          <div>
            {/* Range Date Interval display */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-slate-500">
                <Calendar className="h-5 w-5 text-[#72B100]" />
                <span className="text-sm font-bold text-slate-800">{dateRangeStr}</span>
              </div>
              <div className="text-xs text-slate-400">
                Connected: <span className="font-mono text-slate-500">{client.getBaseUrl()}</span>
              </div>
            </div>

            {/* Dashboard Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                
                {/* Top Section: TIR and key statistics cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  
                  {/* Time in Range Card */}
                  <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold tracking-tight text-slate-900">Time in Range</h2>
                        <p className="text-xs text-slate-400 font-medium">Target: {units === GlucoseUnit.MGDL ? '70-180 mg/dL' : '3.9-10.0 mmol/L'}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-3xl font-extrabold text-[#72B100]">{metrics.timeInTarget}%</span>
                        <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">In Target</p>
                      </div>
                    </div>

                    {/* Visual Stacked Bar - Dexcom Clarity Palette */}
                    <div className="flex gap-6">
                      {/* The Bar */}
                      <div className="flex h-72 w-10 flex-col overflow-hidden rounded bg-slate-100 border border-slate-200/50 shadow-inner">
                        {/* Very High - Amber/Orange */}
                        <div 
                          style={{ height: `${metrics.timeInVeryHigh}%` }} 
                          className="bg-[#F29100] transition-all duration-500"
                          title={`Very High: ${metrics.timeInVeryHigh}%`}
                        />
                        {/* High - Yellow */}
                        <div 
                          style={{ height: `${metrics.timeInHigh}%` }} 
                          className="bg-[#FCD116] transition-all duration-500"
                          title={`High: ${metrics.timeInHigh}%`}
                        />
                        {/* Target - Green */}
                        <div 
                          style={{ height: `${metrics.timeInTarget}%` }} 
                          className="bg-[#72B100] transition-all duration-500"
                          title={`In Range: ${metrics.timeInTarget}%`}
                        />
                        {/* Low - Red */}
                        <div 
                          style={{ height: `${metrics.timeInLow}%` }} 
                          className="bg-[#F04124] transition-all duration-500"
                          title={`Low: ${metrics.timeInLow}%`}
                        />
                        {/* Very Low - Dark Red */}
                        <div 
                          style={{ height: `${metrics.timeInVeryLow}%` }} 
                          className="bg-[#9C0006] transition-all duration-500"
                          title={`Very Low: ${metrics.timeInVeryLow}%`}
                        />
                      </div>

                      {/* Legends and detailed info */}
                      <div className="flex-1 flex flex-col justify-between py-1">
                        {/* Very High Legend */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3.5 w-3.5 rounded bg-[#F29100]" />
                            <div>
                              <span className="font-bold text-slate-700">Very High</span>
                              <span className="ml-2 text-slate-400 text-[10px] font-semibold">{units === GlucoseUnit.MGDL ? '> 250 mg/dL' : '> 13.9 mmol/L'}</span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900">{metrics.timeInVeryHigh}%</span>
                        </div>

                        {/* High Legend */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3.5 w-3.5 rounded bg-[#FCD116]" />
                            <div>
                              <span className="font-bold text-slate-700">High</span>
                              <span className="ml-2 text-slate-400 text-[10px] font-semibold">{units === GlucoseUnit.MGDL ? '181-250 mg/dL' : '10.1-13.9 mmol/L'}</span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900">{metrics.timeInHigh}%</span>
                        </div>

                        {/* Target Legend */}
                        <div className="flex items-center justify-between text-xs py-2 border-y border-slate-100 bg-[#72B100]/5 px-2.5 rounded-lg">
                          <div className="flex items-center gap-2.5">
                            <span className="h-4 w-4 rounded bg-[#72B100]" />
                            <div>
                              <span className="font-extrabold text-[#527e00]">In Range</span>
                              <span className="ml-2 text-[#72B100] text-[10px] font-bold">{units === GlucoseUnit.MGDL ? '70-180 mg/dL' : '3.9-10.0 mmol/L'}</span>
                            </div>
                          </div>
                          <span className="font-extrabold text-[#72B100] text-sm">{metrics.timeInTarget}%</span>
                        </div>

                        {/* Low Legend */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3.5 w-3.5 rounded bg-[#F04124]" />
                            <div>
                              <span className="font-bold text-slate-700">Low</span>
                              <span className="ml-2 text-slate-400 text-[10px] font-semibold">{units === GlucoseUnit.MGDL ? '54-69 mg/dL' : '3.0-3.8 mmol/L'}</span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900">{metrics.timeInLow}%</span>
                        </div>

                        {/* Very Low Legend */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2.5">
                            <span className="h-3.5 w-3.5 rounded bg-[#9C0006]" />
                            <div>
                              <span className="font-bold text-slate-700">Very Low</span>
                              <span className="ml-2 text-slate-400 text-[10px] font-semibold">{units === GlucoseUnit.MGDL ? '< 54 mg/dL' : '< 3.0 mmol/L'}</span>
                            </div>
                          </div>
                          <span className="font-bold text-slate-900">{metrics.timeInVeryLow}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid Cards */}
                  <div className="lg:col-span-5 flex flex-col gap-6">
                    
                    {/* Average Glucose Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Average Glucose</span>
                        <TrendingUp className="h-4.5 w-4.5 text-slate-400" />
                      </div>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold text-slate-900">{metrics.mean}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">{units}</span>
                      </div>
                      <p className="mt-2.5 text-xs text-slate-500 font-medium">
                        Standard Deviation: <span className="font-bold text-slate-800">± {metrics.stdDev} {units}</span>
                      </p>
                    </div>

                    {/* Glucose Management Indicator (GMI) */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Glucose Management Indicator (GMI)</span>
                        <CheckCircle2 className="h-4.5 w-4.5 text-slate-400" />
                      </div>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold text-slate-900">{metrics.gmi}%</span>
                      </div>
                      <p className="mt-2.5 text-[10px] text-slate-400 leading-normal font-medium">
                        An estimate of HbA1c based on average glucose readings over this period. Formerly referred to as estimated HbA1c.
                      </p>
                    </div>

                    {/* Glucose Variability Card */}
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Glucose Variability</span>
                        <Clock className="h-4.5 w-4.5 text-slate-400" />
                      </div>
                      <div className="mt-3 flex items-baseline gap-1.5">
                        <span className="text-4xl font-extrabold text-slate-900">{metrics.cv}%</span>
                        <span className="text-xs font-bold text-slate-400 uppercase">CV</span>
                      </div>
                      <div className="mt-4 flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 rounded-md px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                          metrics.cv <= 36 
                            ? 'bg-[#72B100]/5 text-[#527e00] border-[#72B100]/20' 
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {metrics.cv <= 36 ? 'Stable (Low Variability)' : 'High Variability'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-bold uppercase">Target: ≤ 36%</span>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Hourly Glucose Summary chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <HourlyGlucoseChart hourlyStats={calculate15MinGlucoseStats(entries, units)} days={dateRangeDays} units={units} />
                </div>

                {/* Middle Section: Time in Range by Hour of Day chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <HourlyTIRChart hourlyData={calculateHourlyTIR(entries)} days={dateRangeDays} />
                </div>

              </div>
            )}

            {/* AGP Profile Tab */}
            {activeTab === 'agp' && (
              <div className="space-y-6">
                
                {/* Ambulatory Glucose Profile (AGP) chart */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                  <AGPChart percentiles={calculateAGPPercentiles(entries, units)} units={units} />
                </div>

                {/* Patterns Placeholder Section */}
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm text-left">
                  <h3 className="text-md font-bold text-slate-900 mb-3">Patterns</h3>
                  <div className="rounded-lg border border-slate-100 bg-slate-50 p-6 text-center text-slate-500">
                    <AlertTriangle className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-700">Patterns not implemented yet</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      Algorithm-based pattern detection (e.g., repeating highs/lows at specific times of day) is not implemented in the current version.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* Daily Glucose Logs Tab */}
            {activeTab === 'daily' && (
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                  <h2 className="text-lg font-bold tracking-tight text-slate-900">Daily Glucose Logs</h2>
                  <span className="text-xs text-slate-400 font-bold">Showing {dateRangeDays} days</span>
                </div>

                <div className="divide-y divide-slate-100">
                  {getDaysArray().map((dayDate, idx) => {
                    const start = dayDate.getTime();
                    const end = start + 24 * 60 * 60 * 1000 - 1;

                    // Filter entries and treatments for this day
                    const dayEntries = entries.filter(e => e.date >= start && e.date <= end);
                    const dayTreatments = treatments.filter(t => {
                      const date = t.date || new Date(t.created_at).getTime();
                      return date >= start && date <= end;
                    });

                    // Calculations
                    let mean = '0';
                    let inRangePercent = 0;
                    if (dayEntries.length > 0) {
                      const sum = dayEntries.reduce((acc, e) => acc + e.sgv, 0);
                      const rawMean = sum / dayEntries.length;
                      if (units === GlucoseUnit.MMOL) {
                        mean = (rawMean / 18.018).toFixed(1);
                      } else {
                        mean = Math.round(rawMean).toString();
                      }
                      const inRangeCount = dayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
                      inRangePercent = Math.round((inRangeCount / dayEntries.length) * 100);
                    }

                    const dayCarbs = dayTreatments.reduce((acc, t) => acc + (t.carbs || 0), 0);
                    const dayInsulin = dayTreatments.reduce((acc, t) => acc + (t.insulin || 0), 0);

                    const dateString = dayDate.toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric'
                    });

                    return (
                      <div key={idx} className="flex flex-col md:flex-row items-stretch py-5 gap-6">
                        
                        {/* Left Column: Date & Stats */}
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

                        {/* Middle Column: 24h mini line chart */}
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

                        {/* Right Column: Treatment Summary */}
                        <div className="w-full md:w-36 flex-shrink-0 flex flex-row md:flex-col justify-start md:justify-center items-center md:items-end gap-3 text-xs text-slate-500 font-bold">
                          {dayCarbs > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[10px] text-emerald-700">
                              <span className="h-2 w-2 rounded-full bg-emerald-500" />
                              {dayCarbs}g Carbs
                            </span>
                          )}
                          {dayInsulin > 0 && (
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-100 px-2.5 py-1 text-[10px] text-blue-700">
                              <span className="h-2 w-2 rounded-full bg-blue-500" />
                              {dayInsulin.toFixed(1)} U Insulin
                            </span>
                          )}
                          {dayCarbs === 0 && dayInsulin === 0 && (
                            <span className="text-slate-300 font-normal italic">No events</span>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CGM Active Info Bar */}
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-3 text-center sm:text-left">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sensor Active Wear</span>
                  <div className="mt-1 text-2xl font-extrabold text-slate-800">{wearPercentage}%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Goal is &gt; 70% active wear</div>
                </div>
                <div className="border-t border-slate-200 pt-6 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total CGM Readings</span>
                  <div className="mt-1 text-2xl font-extrabold text-slate-800">{entries.length}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Readings over {dateRangeDays} days</div>
                </div>
                <div className="border-t border-slate-200 pt-6 sm:border-t-0 sm:border-l sm:pl-6 sm:pt-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Average Readings/Day</span>
                  <div className="mt-1 text-2xl font-extrabold text-slate-800">{avgReadingsPerDay}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Target is 288 readings/day</div>
                </div>
              </div>
            </div>
            
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-slate-400">No data could be processed. Please check your connection.</p>
          </div>
        )}
      </main>
    </div>
  );
};
