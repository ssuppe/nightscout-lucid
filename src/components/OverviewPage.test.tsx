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

  /**
   * 200 in-target readings + 1 very-low reading.
   * timeInVeryLow = 1/201 = 0.497...% → rounds to 0 with Math.round.
   * The <1% label must appear AND the bar segment must be rendered (not hidden).
   */
  const setupSparseVeryLowData = () => {
    const now = Date.now();
    const inTarget = Array.from({ length: 200 }, (_, i) => ({
      _id: `t-${i}`,
      date: now - i * 15 * 60 * 1000,
      sgv: 110, // in target (70-180)
      type: 'sgv',
    }));
    const veryLow = [{
      _id: 'vl-1',
      date: now - 201 * 15 * 60 * 1000,
      sgv: 40,  // very low (<54)
      type: 'sgv',
    }];
    vi.mocked(mockClient.fetchEntries).mockResolvedValue([...inTarget, ...veryLow]);
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

  it('renders Compare tab with Trends/Overlay/Daily sub-tabs', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const compareTabBtn = screen.getByRole('button', { name: 'Compare' });
    fireEvent.click(compareTabBtn);

    // Wait for compare content to render
    await waitFor(() => {
      expect(screen.getByTestId('compare-page-content')).toBeInTheDocument();
    });

    // Sub-tab buttons present (Overlay also appears in sidebar, so use getAllByRole)
    expect(screen.getByRole('button', { name: 'Trends' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Overlay' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('button', { name: 'Daily' }).length).toBeGreaterThanOrEqual(1);
  });

  it('renders Compare tab filter dropdowns (Days, Time of Day, Events)', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const compareTabBtn = screen.getByRole('button', { name: 'Compare' });
    fireEvent.click(compareTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('compare-page-content')).toBeInTheDocument();
    });

    // Filter dropdown buttons are present
    expect(screen.getByRole('button', { name: /days/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /time of day/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /events/i })).toBeInTheDocument();
  });

  it('renders Compare tab with Reference and Comparison period labels', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const compareTabBtn = screen.getByRole('button', { name: 'Compare' });
    fireEvent.click(compareTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('compare-page-content')).toBeInTheDocument();
    });

    // Side-by-side date range header labels
    expect(screen.getByText('Reference Period')).toBeInTheDocument();
    expect(screen.getByText('Comparison Period')).toBeInTheDocument();

    // Both AGP charts are rendered
    expect(screen.getAllByTestId('mock-agp-chart').length).toBe(2);
  });

  // ─── Gap-closing tests ──────────────────────────────────────────────────────

  it('unit toggle: switching to mmol/L recalculates and displays the correct converted mean', async () => {
    // 120 mg/dL mean → 120 / 18.018 = 6.66... → rounds to 6.7 mmol/L
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Baseline: mg/dL mean shown as integer
    expect(screen.getByText('120')).toBeInTheDocument();

    // Click mmol/L toggle in the top navbar
    const mmolBtn = screen.getByRole('button', { name: 'mmol/L' });
    fireEvent.click(mmolBtn);

    // Mean should now show mmol/L value — 120 mg/dL = 6.7 mmol/L
    await waitFor(() => {
      expect(screen.getByText('6.7')).toBeInTheDocument();
    });
    // The old integer string '120' should no longer appear as the mean label
    // (it may still exist in other contexts so we check the mean card specifically)
    expect(screen.queryByText('120')).not.toBeInTheDocument();
  });

  it('fetchEntries failure shows error banner with "Failed to sync data" heading and Retry button', async () => {
    vi.mocked(mockClient.fetchEntries).mockRejectedValue(
      new Error('Network error: CORS settings blocked the request')
    );
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to sync data')).toBeInTheDocument();
    });

    // Error message text is shown
    expect(screen.getByText(/CORS settings blocked/i)).toBeInTheDocument();

    // Retry button is present and clicking it triggers another fetch
    const retryBtn = screen.getByRole('button', { name: /Retry Fetch/i });
    expect(retryBtn).toBeInTheDocument();
    fireEvent.click(retryBtn);
    // After retry click fetchEntries should be called a second time
    expect(vi.mocked(mockClient.fetchEntries).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('date-range button calls fetchEntries with a from date ~30 days in the past', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    vi.mocked(mockClient.fetchEntries).mockClear();
    setupMockData(120); // re-arm mock for the next call

    fireEvent.click(screen.getByRole('button', { name: '30d' }));

    await waitFor(() => {
      expect(vi.mocked(mockClient.fetchEntries)).toHaveBeenCalled();
    });

    const [fromArg, toArg] = vi.mocked(mockClient.fetchEntries).mock.calls[0] as [Date, Date];
    const diffDays = (toArg.getTime() - fromArg.getTime()) / (1000 * 60 * 60 * 24);
    // Should be approximately 30 days (allow ±1 for timing)
    expect(diffDays).toBeGreaterThanOrEqual(29);
    expect(diffDays).toBeLessThanOrEqual(31);
  });

  it('displays <1% label and renders a visible sliver in the TIR stacked bar for very low category with 1 reading', async () => {
    setupSparseVeryLowData();
    const { container } = render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Check that <1% label is shown for Very Low
    expect(screen.getByText('<1%')).toBeInTheDocument();

    // Check that the very-low bar segment (bg-[#9C0006]) is rendered in the DOM
    const veryLowSegment = container.querySelector('.bg-\\[\\#9C0006\\]');
    expect(veryLowSegment).toBeInTheDocument();
    expect(veryLowSegment).toHaveStyle('height: 1%');
  });
});

