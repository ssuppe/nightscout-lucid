import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewPage } from './OverviewPage';
import { NightscoutClient, GlucoseUnit } from '../utils/nightscout';

// Mock child chart components to avoid canvas rendering dependencies during page-level tests
vi.mock('./AGPChart', () => ({
  AGPChart: () => <div data-testid="mock-agp-chart" />,
}));
vi.mock('./HourlyTIRChart', () => ({
  HourlyTIRChart: () => <div data-testid="mock-hourly-tir-chart" />,
}));
vi.mock('./HourlyGlucoseChart', () => ({
  HourlyGlucoseChart: () => <div data-testid="mock-hourly-glucose-chart" />,
}));
vi.mock('./DailyMiniChart', () => ({
  DailyMiniChart: () => <div data-testid="mock-daily-mini-chart" />,
}));
vi.mock('./WeeklyOverlayChart', () => ({
  WeeklyOverlayChart: () => <div data-testid="mock-weekly-overlay-chart" />,
}));
vi.mock('./DailyStatsTable', () => ({
  DailyStatsTable: () => <div data-testid="mock-daily-stats-table" />,
}));
vi.mock('./HourlyStatsTable', () => ({
  HourlyStatsTable: () => <div data-testid="mock-hourly-stats-table" />,
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

    expect(screen.getByText('Average glucose')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument(); // Mean value
    expect(screen.getAllByText('mg/dL').length).toBeGreaterThan(0); // Units display

    expect(screen.getByText('GMI')).toBeInTheDocument();
    expect(screen.getByText('6.2%')).toBeInTheDocument(); // GMI value

    expect(screen.getByText('Coefficient of Variation')).toBeInTheDocument();
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0); // Standard deviation is 0, so CV is 0
  });

  it('correctly toggles the active date range', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const btn30 = screen.getByRole('button', { name: '30d' });
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

  it('renders Overview tab content by default (including hourly glucose chart)', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('mock-hourly-glucose-chart')).toBeInTheDocument();
    expect(screen.queryByTestId('mock-agp-chart')).not.toBeInTheDocument();
  });

  it('renders AGP Profile tab contents when clicked', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const agpTabBtn = screen.getByRole('button', { name: 'AGP' });
    fireEvent.click(agpTabBtn);

    expect(screen.getByTestId('mock-agp-chart')).toBeInTheDocument();
  });

  it('renders Daily Logs tab contents with daily row entries when clicked', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const dailyTabBtn = screen.getByRole('button', { name: 'Daily' });
    fireEvent.click(dailyTabBtn);

    expect(screen.getByRole('heading', { name: 'daily' })).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-daily-mini-chart').length).toBeGreaterThan(0);
  });

  it('renders Overlay tab contents with filter controls when clicked', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const overlayTabBtn = screen.getByRole('button', { name: 'Overlay' });
    fireEvent.click(overlayTabBtn);

    expect(screen.getByText('Event Filtering')).toBeInTheDocument();
    expect(screen.getByText('Days of Week')).toBeInTheDocument();
    expect(screen.getAllByTestId('mock-weekly-overlay-chart').length).toBeGreaterThan(0);
  });

  it('renders Statistics tab contents with daily stats table when clicked', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const statsTabBtn = screen.getByRole('button', { name: 'Statistics' });
    fireEvent.click(statsTabBtn);

    expect(screen.getByText('Daily Table')).toBeInTheDocument();
    expect(screen.getByTestId('mock-daily-stats-table')).toBeInTheDocument();

    const hourlySubTabBtn = screen.getByRole('button', { name: 'Hourly Table' });
    fireEvent.click(hourlySubTabBtn);
    expect(screen.getByTestId('mock-hourly-stats-table')).toBeInTheDocument();
  });
});
