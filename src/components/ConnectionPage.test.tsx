import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ConnectionPage } from './ConnectionPage';
import { GlucoseUnit } from '../utils/nightscout';

// Mock the NightscoutClient class
vi.mock('../utils/nightscout', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/nightscout')>();
  return {
    ...actual,
    NightscoutClient: vi.fn().mockImplementation((url, token) => {
      return {
        getBaseUrl: () => url.replace(/\/$/, ''),
        getAuthHeaders: vi.fn(),
        fetchProfile: vi.fn().mockImplementation(async () => {
          if (token === 'invalid-token') {
            throw new Error('Nightscout authentication failed');
          }
          if (url.includes('cors-fail')) {
            throw new Error('Network error: CORS settings blocked the request');
          }
          return [{ defaultProfile: 'Default' }];
        }),
        fetchEntries: vi.fn().mockResolvedValue([]),
        fetchTreatments: vi.fn().mockResolvedValue([]),
      };
    }),
  };
});

describe('ConnectionPage', () => {
  const mockOnConnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders connection form elements', () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);

    expect(screen.getByLabelText(/Nightscout URL/i)).toBeInTheDocument();
    expect(screen.getByLabelText('API Token')).toBeInTheDocument();
    expect(screen.getByLabelText(/Preferred Units/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect/i })).toBeInTheDocument();
  });

  it('shows error if URL format is invalid', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);

    const urlInput = screen.getByLabelText(/Nightscout URL/i);
    fireEvent.change(urlInput, {
      target: { value: 'not-a-valid-url' },
    });
    
    const form = urlInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Please enter a valid URL/i)).toBeInTheDocument();
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it('connects successfully with valid credentials and triggers onConnect', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);

    const urlInput = screen.getByLabelText(/Nightscout URL/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://my-nightscout.herokuapp.com' },
    });
    fireEvent.change(screen.getByLabelText('API Token'), {
      target: { value: 'valid-secret' },
    });
    fireEvent.change(screen.getByLabelText(/Preferred Units/i), {
      target: { value: GlucoseUnit.MMOL },
    });

    const form = urlInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith(
        expect.any(Object),
        'https://my-nightscout.herokuapp.com',
        'valid-secret',
        GlucoseUnit.MMOL
      );
    });
  });

  it('shows auth error message when credentials verification fails', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);

    const urlInput = screen.getByLabelText(/Nightscout URL/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://my-nightscout.herokuapp.com' },
    });
    fireEvent.change(screen.getByLabelText('API Token'), {
      target: { value: 'invalid-token' },
    });

    const form = urlInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Nightscout authentication failed/i)).toBeInTheDocument();
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it('shows CORS error message when network request fails', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);

    const urlInput = screen.getByLabelText(/Nightscout URL/i);
    fireEvent.change(urlInput, {
      target: { value: 'https://cors-fail.com' },
    });
    fireEvent.change(screen.getByLabelText('API Token'), {
      target: { value: 'valid-token' },
    });

    const form = urlInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/CORS settings/i)).toBeInTheDocument();
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it('renders tab switcher for login modes', () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);
    expect(screen.getByRole('tab', { name: /Nightscout Login/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Nurse Access Code/i })).toBeInTheDocument();
  });

  it('shows error when incorrect access code is entered on Access Code tab', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);
    
    // Switch to Access Code tab
    const accessCodeTab = screen.getByRole('tab', { name: /Nurse Access Code/i });
    fireEvent.click(accessCodeTab);

    // Assert manual fields are hidden and Access Code input is visible
    expect(screen.queryByLabelText(/Nightscout URL/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Access Code')).toBeInTheDocument();

    const codeInput = screen.getByLabelText('Access Code');
    fireEvent.change(codeInput, { target: { value: 'WrongPassword!' } });

    const form = codeInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Invalid access code/i)).toBeInTheDocument();
    expect(mockOnConnect).not.toHaveBeenCalled();
  });

  it('successfully logs in with the correct access code using the proxy URL', async () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);
    
    const accessCodeTab = screen.getByRole('tab', { name: /Nurse Access Code/i });
    fireEvent.click(accessCodeTab);

    const codeInput = screen.getByLabelText('Access Code');
    fireEvent.change(codeInput, { target: { value: 'mock-access-code' } });

    const form = codeInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockOnConnect).toHaveBeenCalledWith(
        expect.any(Object),
        expect.stringContaining('/api/nurse'),
        'mock-access-code',
        expect.any(String)
      );
    });
  });

  it('toggles visibility of API Token input when show/hide button is clicked', () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);
    const tokenInput = screen.getByLabelText('API Token') as HTMLInputElement;
    expect(tokenInput.type).toBe('password');

    // Click show button (using aria-label or specific test-id/icon check)
    const toggleButton = screen.getByLabelText('Toggle API Token visibility');
    fireEvent.click(toggleButton);
    expect(tokenInput.type).toBe('text');

    fireEvent.click(toggleButton);
    expect(tokenInput.type).toBe('password');
  });

  it('toggles visibility of Access Code input when show/hide button is clicked', () => {
    render(<ConnectionPage onConnect={mockOnConnect} />);
    
    const accessCodeTab = screen.getByRole('tab', { name: /Nurse Access Code/i });
    fireEvent.click(accessCodeTab);

    const codeInput = screen.getByLabelText('Access Code') as HTMLInputElement;
    expect(codeInput.type).toBe('password');

    const toggleButton = screen.getByLabelText('Toggle Access Code visibility');
    fireEvent.click(toggleButton);
    expect(codeInput.type).toBe('text');

    fireEvent.click(toggleButton);
    expect(codeInput.type).toBe('password');
  });
});
