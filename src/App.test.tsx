import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';
import { GlucoseUnit } from './utils/nightscout';

// Mock child components to isolate App testing
vi.mock('./components/ConnectionPage', () => {
  return {
    ConnectionPage: ({ onConnect }: any) => (
      <div>
        <label htmlFor="mock-url">Nightscout URL</label>
        <input id="mock-url" defaultValue="https://mock-ns.com" />
        <button 
          onClick={() => onConnect({ getBaseUrl: () => 'https://mock-ns.com' }, 'https://mock-ns.com', 'secret', GlucoseUnit.MGDL)}
        >
          Connect
        </button>
      </div>
    ),
  };
});

vi.mock('./components/OverviewPage', () => {
  return {
    OverviewPage: ({ onDisconnect }: any) => (
      <div>
        <h1>Overview</h1>
        <button onClick={onDisconnect}>Disconnect</button>
      </div>
    ),
  };
});

describe('App Component Router', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders ConnectionPage by default when no session exists', () => {
    render(<App />);
    expect(screen.getByLabelText(/Nightscout URL/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Overview/i })).not.toBeInTheDocument();
  });

  it('connects and switches to OverviewPage, writing to sessionStorage', async () => {
    render(<App />);
    
    const btn = screen.getByRole('button', { name: /Connect/i });
    fireEvent.click(btn);

    expect(await screen.findByRole('heading', { name: /Overview/i })).toBeInTheDocument();
    expect(sessionStorage.getItem('ns_lucid_url')).toBe('https://mock-ns.com');
    expect(sessionStorage.getItem('ns_lucid_token')).toBe('secret');
  });

  it('restores session from sessionStorage on initial load', () => {
    sessionStorage.setItem('ns_lucid_url', 'https://saved-ns.com');
    sessionStorage.setItem('ns_lucid_token', 'saved-secret');
    sessionStorage.setItem('ns_lucid_units', GlucoseUnit.MMOL);

    render(<App />);

    expect(screen.getByRole('heading', { name: /Overview/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Nightscout URL/i)).not.toBeInTheDocument();
  });

  it('disconnects, clears sessionStorage, and returns to ConnectionPage', async () => {
    sessionStorage.setItem('ns_lucid_url', 'https://saved-ns.com');
    sessionStorage.setItem('ns_lucid_token', 'saved-secret');

    render(<App />);

    expect(screen.getByRole('heading', { name: /Overview/i })).toBeInTheDocument();

    const btn = screen.getByRole('button', { name: /Disconnect/i });
    fireEvent.click(btn);

    expect(await screen.findByLabelText(/Nightscout URL/i)).toBeInTheDocument();
    expect(sessionStorage.getItem('ns_lucid_url')).toBeNull();
    expect(sessionStorage.getItem('ns_lucid_token')).toBeNull();
  });
});
