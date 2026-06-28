import { useState } from 'react';
import { ConnectionPage } from './components/ConnectionPage';
import { OverviewPage } from './components/OverviewPage';
import { NightscoutClient, GlucoseUnit } from './utils/nightscout';
import './App.css';

function App() {
  // Session storage keys
  const URL_KEY = 'ns_lucid_url';
  const TOKEN_KEY = 'ns_lucid_token';
  const UNITS_KEY = 'ns_lucid_units';

  // Read initial states from sessionStorage
  const [storedUrl, setStoredUrl] = useState(() => sessionStorage.getItem(URL_KEY) || '');
  const [storedToken, setStoredToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [storedUnits, setStoredUnits] = useState<GlucoseUnit>(() => {
    const val = sessionStorage.getItem(UNITS_KEY);
    return (val === GlucoseUnit.MMOL ? GlucoseUnit.MMOL : GlucoseUnit.MGDL);
  });

  const [client, setClient] = useState<NightscoutClient | null>(() => {
    const url = sessionStorage.getItem(URL_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (url && token) {
      try {
        return new NightscoutClient(url, token);
      } catch {
        return null;
      }
    }
    return null;
  });

  const handleConnect = (
    newClient: NightscoutClient,
    url: string,
    token: string,
    units: GlucoseUnit
  ) => {
    sessionStorage.setItem(URL_KEY, url);
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(UNITS_KEY, units);

    setStoredUrl(url);
    setStoredToken(token);
    setStoredUnits(units);
    setClient(newClient);
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem(URL_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(UNITS_KEY);

    setStoredUrl('');
    setStoredToken('');
    setStoredUnits(GlucoseUnit.MGDL);
    setClient(null);
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-slate-800">
      {client ? (
        <OverviewPage
          client={client}
          preferredUnits={storedUnits}
          onDisconnect={handleDisconnect}
        />
      ) : (
        <ConnectionPage
          onConnect={handleConnect}
          initialUrl={storedUrl}
          initialToken={storedToken}
          initialUnits={storedUnits}
        />
      )}
    </div>
  );
}

export default App;
