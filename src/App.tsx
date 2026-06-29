import { useState } from 'react';
import { ConnectionPage } from './components/ConnectionPage';
import { OverviewPage } from './components/OverviewPage';
import { NightscoutClient, GlucoseUnit, TokenType } from './utils/nightscout';
import './App.css';

function App() {
  // Session storage keys
  const URL_KEY = 'ns_lucid_url';
  const TOKEN_KEY = 'ns_lucid_token';
  const UNITS_KEY = 'ns_lucid_units';
  const TOKEN_TYPE_KEY = 'ns_lucid_token_type';

  // Read initial states from sessionStorage
  const [storedUrl, setStoredUrl] = useState(() => sessionStorage.getItem(URL_KEY) || '');
  const [storedToken, setStoredToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '');
  const [storedUnits, setStoredUnits] = useState<GlucoseUnit>(() => {
    const val = sessionStorage.getItem(UNITS_KEY);
    return (val === GlucoseUnit.MGDL ? GlucoseUnit.MGDL : GlucoseUnit.MMOL);
  });
  const [storedTokenType, setStoredTokenType] = useState<TokenType>(() => {
    const val = sessionStorage.getItem(TOKEN_TYPE_KEY);
    return Object.values(TokenType).includes(val as TokenType)
      ? (val as TokenType)
      : TokenType.AUTO;
  });

  const [client, setClient] = useState<NightscoutClient | null>(() => {
    const url = sessionStorage.getItem(URL_KEY);
    const token = sessionStorage.getItem(TOKEN_KEY);
    const tokenTypeVal = sessionStorage.getItem(TOKEN_TYPE_KEY);
    const tokenType = Object.values(TokenType).includes(tokenTypeVal as TokenType)
      ? (tokenTypeVal as TokenType)
      : TokenType.AUTO;
    if (url && token) {
      try {
        return new NightscoutClient(url, token, tokenType);
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
    units: GlucoseUnit,
    tokenType: TokenType,
  ) => {
    sessionStorage.setItem(URL_KEY, url);
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(UNITS_KEY, units);
    sessionStorage.setItem(TOKEN_TYPE_KEY, tokenType);

    setStoredUrl(url);
    setStoredToken(token);
    setStoredUnits(units);
    setStoredTokenType(tokenType);
    setClient(newClient);
  };

  const handleDisconnect = () => {
    sessionStorage.removeItem(URL_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(UNITS_KEY);
    sessionStorage.removeItem(TOKEN_TYPE_KEY);

    setStoredUrl('');
    setStoredToken('');
    setStoredUnits(GlucoseUnit.MMOL);
    setStoredTokenType(TokenType.AUTO);
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
          initialTokenType={storedTokenType}
        />
      )}
    </div>
  );
}

export default App;
