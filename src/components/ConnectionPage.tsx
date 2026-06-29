import React, { useState } from 'react';
import { Activity, Wifi, AlertCircle, HelpCircle } from 'lucide-react';
import { NightscoutClient, GlucoseUnit } from '../utils/nightscout';

interface ConnectionPageProps {
  onConnect: (client: NightscoutClient, url: string, token: string, units: GlucoseUnit) => void;
  initialUrl?: string;
  initialToken?: string;
  initialUnits?: GlucoseUnit;
}

export const ConnectionPage: React.FC<ConnectionPageProps> = ({
  onConnect,
  initialUrl = '',
  initialToken = '',
  initialUnits = GlucoseUnit.MMOL,
}) => {
  const [url, setUrl] = useState(initialUrl);
  const [token, setToken] = useState(initialToken);
  const [units, setUnits] = useState<GlucoseUnit>(initialUnits);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);

  const [loginMode, setLoginMode] = useState<'manual' | 'code'>('manual');
  const [accessCode, setAccessCode] = useState('');
  const [accessCodeError, setAccessCodeError] = useState<string | null>(null);

  const validateInputs = (): boolean => {
    setUrlValidationError(null);
    setAccessCodeError(null);
    setError(null);

    if (loginMode === 'code') {
      if (!accessCode.trim()) {
        setAccessCodeError('Access Code is required');
        return false;
      }
      if (accessCode.trim() !== 'mock-access-code') {
        setAccessCodeError('Invalid access code. Please try again.');
        return false;
      }
      return true;
    }

    let cleanUrl = url.trim();
    if (!cleanUrl) {
      setUrlValidationError('Nightscout URL is required');
      return false;
    }

    try {
      const parsedUrl = new URL(cleanUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        setUrlValidationError('Please enter a valid URL with http or https protocol');
        return false;
      }
    } catch {
      setUrlValidationError('Please enter a valid URL format (e.g., https://my-nightscout.herokuapp.com)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInputs()) return;

    setLoading(true);
    setError(null);

    let cleanUrl = '';
    let cleanToken = '';

    if (loginMode === 'code') {
      // Use proxy endpoint and pass the access code as the token
      cleanUrl = window.location.origin + '/api/nurse';
      cleanToken = accessCode.trim();
    } else {
      cleanUrl = url.trim();
      cleanToken = token.trim();
    }

    try {
      const client = new NightscoutClient(cleanUrl, cleanToken);
      // Verify connection by fetching profile
      await client.fetchProfile();
      
      // If successful, invoke callback
      onConnect(client, cleanUrl, cleanToken, units);
    } catch (err: any) {
      setError(err?.message || 'Failed to connect to Nightscout');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12 text-slate-800 font-sans">
      <div className="w-full max-w-lg overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl transition-all duration-300">
        
        {/* Top Accent Strip - Clarity Lime Green */}
        <div className="h-2 bg-[#72B100]" />

        <div className="p-8">
          {/* Header / Brand */}
          <div className="mb-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-[#72B100] text-white shadow-md shadow-emerald-500/10">
              <Activity className="h-7 w-7 stroke-[2.5]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Nightscout Lucid
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Clarity for your Nightscout data
            </p>
          </div>

          {/* Tab Switcher */}
          <div className="mb-6 flex rounded-lg bg-slate-100 p-1">
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'manual'}
              onClick={() => setLoginMode('manual')}
              className={`flex-1 rounded-md py-2 text-center text-xs font-bold transition duration-200 cursor-pointer ${
                loginMode === 'manual'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Nightscout Login
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={loginMode === 'code'}
              onClick={() => setLoginMode('code')}
              className={`flex-1 rounded-md py-2 text-center text-xs font-bold transition duration-200 cursor-pointer ${
                loginMode === 'code'
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Nurse Access Code
            </button>
          </div>

          {/* Connection Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            
            {loginMode === 'manual' ? (
              <>
                {/* Nightscout URL Input */}
                <div>
                  <label htmlFor="ns-url" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                    Nightscout URL
                  </label>
                  <div className="relative mt-2">
                    <input
                      id="ns-url"
                      type="text"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://your-nightscout.herokuapp.com"
                      className={`w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition duration-200 outline-none focus:bg-white focus:ring-2 focus:ring-[#72B100]/25 ${
                        urlValidationError ? 'border-red-500' : 'border-slate-300 focus:border-[#72B100]'
                      }`}
                      disabled={loading}
                    />
                  </div>
                  {urlValidationError && (
                    <p className="mt-2 flex items-center text-xs text-red-500">
                      <AlertCircle className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                      {urlValidationError}
                    </p>
                  )}
                </div>

                {/* API Token Input */}
                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="ns-token" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                      API Token
                    </label>
                    <span className="text-[10px] text-slate-400 uppercase tracking-widest">(API Secret or JWT)</span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      id="ns-token"
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="enter api token or hash secret"
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition duration-200 outline-none focus:bg-white focus:border-[#72B100] focus:ring-2 focus:ring-[#72B100]/25"
                      disabled={loading}
                    />
                  </div>
                </div>
              </>
            ) : (
              /* Access Code Input */
              <div>
                <label htmlFor="ns-code" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                  Access Code
                </label>
                <div className="relative mt-2">
                  <input
                    id="ns-code"
                    type="password"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter nurse access code"
                    className={`w-full rounded-lg border bg-slate-50 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition duration-200 outline-none focus:bg-white focus:ring-2 focus:ring-[#72B100]/25 ${
                      accessCodeError ? 'border-red-500' : 'border-slate-300 focus:border-[#72B100]'
                    }`}
                    disabled={loading}
                  />
                </div>
                {accessCodeError && (
                  <p className="mt-2 flex items-center text-xs text-red-500">
                    <AlertCircle className="mr-1.5 h-3.5 w-3.5 flex-shrink-0" />
                    {accessCodeError}
                  </p>
                )}
              </div>
            )}

            {/* Preferred Units Input */}
            <div>
              <label htmlFor="ns-units" className="block text-xs font-bold uppercase tracking-wider text-slate-600">
                Preferred Units
              </label>
              <div className="relative mt-2">
                <select
                  id="ns-units"
                  value={units}
                  onChange={(e) => setUnits(e.target.value as GlucoseUnit)}
                  className="w-full appearance-none rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition duration-200 outline-none focus:bg-white focus:border-[#72B100] focus:ring-2 focus:ring-[#72B100]/25"
                  disabled={loading}
                >
                  <option value={GlucoseUnit.MGDL}>mg/dL (USA Standard)</option>
                  <option value={GlucoseUnit.MMOL}>mmol/L (International Standard)</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400">
                  <HelpCircle className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Error Message Box */}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-slate-800">
                <div className="flex">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mr-3" />
                  <div className="text-xs leading-5">
                    <span className="font-bold text-red-800">Connection Failed:</span>
                    <p className="mt-1 font-mono break-all">{error}</p>
                    {error.toLowerCase().includes('cors') && (
                      <div className="mt-3 border-t border-red-200 pt-2.5 text-slate-600 leading-relaxed font-sans">
                        <p className="font-semibold text-slate-700">How to fix CORS issues:</p>
                        <ul className="list-disc pl-4 mt-1.5 space-y-1">
                          <li>Ensure you added <code className="bg-red-100 px-1 py-0.5 rounded text-red-800 font-bold">CORS_ALLOW_ORIGIN=*</code> to your Nightscout environment variables (e.g. on Heroku/Render).</li>
                          <li>Restart your Nightscout instance after updating settings.</li>
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-[#72B100] px-4 py-3.5 text-sm font-bold text-white shadow-md transition duration-200 hover:bg-[#619500] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying Connection...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Wifi className="h-4 w-4" />
                  Connect & Load Data
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Footer Notes */}
        <div className="border-t border-slate-100 bg-slate-50 px-8 py-6 text-center text-xs text-slate-400 leading-normal">
          <p>
            Your credentials and loaded health data are stored locally in this browser tab's memory and are never sent to any third-party server.
          </p>
        </div>
      </div>
    </div>
  );
};
