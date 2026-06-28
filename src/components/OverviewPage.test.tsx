import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewPage } from './OverviewPage';
import { NightscoutClient, GlucoseUnit } from '../utils/nightscout';

// Mock AGPChart to avoid canvas rendering dependencies during page-level tests
vi.mock('./AGPChart', () => ({
  AGPChart: () => <div data-testid="mock-agp-chart" />,
}));

// Mock NightscoutClient
const mockClient = {
  getBaseUrl: () => 'https://my-nightscout.com',
  fetchEntries: vi.fn(),
  fetchTreatments: vi.fn(),
  fetchProfile: vi.fn(),
} as unknown as NightscoutClient;

describe('OverviewPage', () => {
  const mockOnDisconnect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMockData = (avgGlucose: number) => {
    // Mock 100 entries with average value = avgGlucose
    const mockEntries = Array.from({ length: 100 }, (_, i) => ({
      _id: `id-${i}`,
      date: Date.now() - i * 15 * 60 * 1000,
      sgv: avgGlucose,
      type: 'sgv',
    }));
    
    vi.mocked(mockClient.fetchEntries).mockResolvedValue(mockEntries);
    vi.mocked(mockClient.fetchTreatments).mockResolvedValue([]);
  };

  it('renders loading state initially', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);
    
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders metrics cards once data is loaded', async () => {
    setupMockData(120); // Average is 120 mg/dL, GMI = 3.31 + 0.02392 * 120 = 6.2%
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    // Wait for the loader to disappear and overview elements to show
    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByText('Average Glucose')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument(); // Mean value
    expect(screen.getAllByText('mg/dL').length).toBeGreaterThan(0); // Units display

    expect(screen.getByText('Glucose Management Indicator (GMI)')).toBeInTheDocument();
    expect(screen.getByText('6.2%')).toBeInTheDocument(); // GMI value

    expect(screen.getByText('Glucose Variability')).toBeInTheDocument();
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0); // Standard deviation is 0, so CV is 0
  });

  it('correctly toggles the active date range', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const btn30 = screen.getByRole('button', { name: '30 Days' });
    fireEvent.click(btn30);

    // Should show loading spinner again while fetching 30 days of data
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('allows disconnecting and returning to connection page', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const btnDisconnect = screen.getByRole('button', { name: /Disconnect/i });
    fireEvent.click(btnDisconnect);

    expect(mockOnDisconnect).toHaveBeenCalled();
  });

  it('displays the AGP Profile tab contents and placeholder patterns card when clicked', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const agpTabBtn = screen.getByRole('button', { name: 'AGP Profile' });
    fireEvent.click(agpTabBtn);

    // Verify AGP specific elements are displayed
    expect(screen.getByTestId('mock-agp-chart')).toBeInTheDocument();
    expect(screen.getByText('Patterns')).toBeInTheDocument();
    expect(screen.getByText('Patterns not implemented yet')).toBeInTheDocument();
  });
});
