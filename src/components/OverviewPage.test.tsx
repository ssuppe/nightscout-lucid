import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewPage, resolveOklchStrings, oklchCache } from './OverviewPage';
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
  WeeklyOverlayChart: ({ weekLabel }: any) => <div data-testid="mock-weekly-overlay-chart">{weekLabel}</div>,
}));
vi.mock('./DailyStatsTable', () => ({
  DailyStatsTable: () => <div data-testid="mock-daily-stats-table" />,
}));
vi.mock('./HourlyStatsTable', () => ({
  HourlyStatsTable: () => <div data-testid="mock-hourly-stats-table" />,
}));

// Mock html2canvas and jspdf
vi.mock('html2canvas', () => ({
  default: vi.fn().mockResolvedValue({
    toDataURL: () => 'data:image/jpeg;base64,mockImage',
  }),
}));

vi.mock('jspdf', () => {
  const mockjsPDF = vi.fn().mockImplementation(() => ({
    internal: {
      pageSize: {
        getWidth: () => 297,
        getHeight: () => 210,
      },
    },
    getImageProperties: () => ({ width: 100, height: 100 }),
    addPage: vi.fn(),
    addImage: vi.fn(),
    save: vi.fn(),
    setFontSize: vi.fn(),
    setFont: vi.fn(),
    setTextColor: vi.fn(),
    text: vi.fn(),
  }));
  return {
    default: mockjsPDF,
    jsPDF: mockjsPDF,
  };
});

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

  /**
   * Generates 100 entries spread over 9 days, sorted oldest-first.
   * Newest = now, Oldest = now - 9 days.
   */
  const setupOldestFirstMockData = () => {
    const now = Date.now();
    const mockEntries = Array.from({ length: 100 }, (_, i) => ({
      _id: `id-${i}`,
      date: now - i * (9 * 24 * 60 * 60 * 1000) / 99, // spread over 9 days
      sgv: 120,
      type: 'sgv',
    })).reverse(); // oldest-first

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

    expect(screen.getByRole('heading', { name: 'AGP' })).toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Daily' })).toBeInTheDocument();
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

  it('clamps the oldest week start date to rangeStart when dateRangeDays is 30 (non-multiple of 7) to avoid double-counting or out-of-bounds dates', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Set to 30d range
    const btn30 = screen.getByRole('button', { name: '30d' });
    fireEvent.click(btn30);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Go to Overlay tab
    const overlayTabBtn = screen.getByRole('button', { name: 'Overlay' });
    fireEvent.click(overlayTabBtn);

    // Calculate rangeStart: today - 29 days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const rangeStart = new Date(today);
    rangeStart.setDate(today.getDate() - 29); // 30 days total (today is index 0)
    rangeStart.setHours(0, 0, 0, 0);

    const rangeStartStr = rangeStart.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });

    // The oldest week should be Week 5
    // Without clamping, Week 5 starts at today - 34 days.
    // With clamping, Week 5 starts at today - 29 days (rangeStartStr).
    // Let's verify that the text matches the clamped rangeStartStr
    expect(screen.getByText(new RegExp(`Week of ${rangeStartStr}`, 'i'))).toBeInTheDocument();
  });

  it('correctly calculates active sensor days and wear percentage when displayEntries is sorted oldest-first', async () => {
    setupOldestFirstMockData();
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // 100 entries spread over 9 days.
    // Wear percentage = Math.round(((100 / 9) / 288) * 100) = Math.round(3.858...) = 4%
    // If the bug exists (giving negative or clamped activeSensorDays = 1 due to oldest-first sorting):
    // Wear percentage = Math.round(((100 / 1) / 288) * 100) = 35%
    const elements = screen.getAllByText('4%');
    expect(elements.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('35%')).not.toBeInTheDocument();
  });

  it('includes entries from the early hours of the oldest day (M3)', async () => {
    // Generate an entry at exactly midnight (00:00:00.000) 14 days ago
    const now = new Date();
    const oldestEntryTime = new Date(now);
    oldestEntryTime.setDate(now.getDate() - 14);
    oldestEntryTime.setHours(0, 0, 0, 0);
    
    const mockEntries = [
      { _id: 'oldest-early', date: oldestEntryTime.getTime(), sgv: 120, type: 'sgv' }
    ];
    vi.mocked(mockClient.fetchEntries).mockResolvedValue(mockEntries);
    vi.mocked(mockClient.fetchTreatments).mockResolvedValue([]);

    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Total CGM Readings should display "1" if included, or "0" if filtered out.
    const readingsCard = screen.getByText('Total CGM Readings').closest('div');
    expect(readingsCard).toHaveTextContent('1');
  });

  it('correctly splits entries between Comparison Period (A) and Reference Period (B) in the Compare tab', async () => {
    const now = Date.now();
    const entriesA = Array.from({ length: 10 }, (_, i) => ({
      _id: `a-${i}`,
      date: now - i * 1 * 24 * 60 * 60 * 1000, // last 10 days (in Period A)
      sgv: 100,
      type: 'sgv',
    }));
    const entriesB = Array.from({ length: 10 }, (_, i) => ({
      _id: `b-${i}`,
      date: now - (i + 15) * 1 * 24 * 60 * 60 * 1000, // 15-25 days ago (in Period B)
      sgv: 200,
      type: 'sgv',
    }));

    vi.mocked(mockClient.fetchEntries).mockResolvedValue([...entriesA, ...entriesB]);
    vi.mocked(mockClient.fetchTreatments).mockResolvedValue([]);

    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const compareTabBtn = screen.getByRole('button', { name: 'Compare' });
    fireEvent.click(compareTabBtn);

    await waitFor(() => {
      expect(screen.getByTestId('compare-page-content')).toBeInTheDocument();
    });

    // Comparison Period (A) should show mean 100 mg/dL, Reference Period (B) should show mean 200 mg/dL
    expect(screen.getByText('100 mg/dL')).toBeInTheDocument();
    expect(screen.getByText('200 mg/dL')).toBeInTheDocument();
  });

  it('renders weekdays selector starting from Monday (L1)', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const overlayTabBtn = screen.getByRole('button', { name: 'Overlay' });
    fireEvent.click(overlayTabBtn);

    await waitFor(() => {
      expect(screen.getByText('Days of Week')).toBeInTheDocument();
    });

    const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const weekdayCheckboxes = dayLabels.map(label => screen.getByLabelText(label));
    
    // Verify order in the DOM (Mon should be before Tue, etc.)
    for (let i = 0; i < weekdayCheckboxes.length - 1; i++) {
      const current = weekdayCheckboxes[i];
      const next = weekdayCheckboxes[i + 1];
      expect(current.compareDocumentPosition(next) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('simplifies reports header buttons and handles CSV export click', async () => {
    // mock URL.createObjectURL and URL.revokeObjectURL
    const createObjectURLMock = vi.fn().mockReturnValue('blob:mock-url');
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    // spy on click on link/download
    const clickMock = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const el = originalCreateElement(tagName);
      if (tagName === 'a') {
        el.click = clickMock;
      }
      return el;
    });

    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    // Verify Printer and Email button do NOT exist
    expect(screen.queryByTitle('Print')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Email Reports')).not.toBeInTheDocument();

    // Verify Download PDF and Export CSV button exist
    const downloadPdfBtn = screen.getByTitle('Download PDF');
    const exportCsvBtn = screen.getByTitle('Export CSV');
    expect(downloadPdfBtn).toBeInTheDocument();
    expect(exportCsvBtn).toBeInTheDocument();

    // Click Export CSV button
    fireEvent.click(exportCsvBtn);

    // Verify CSV trigger and link click
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalled();

    createElementSpy.mockRestore();
  });

  it('triggers PDF download and displays progress bar overlay', async () => {
    setupMockData(120);
    render(<OverviewPage client={mockClient} preferredUnits={GlucoseUnit.MGDL} onDisconnect={mockOnDisconnect} />);

    await waitFor(() => {
      expect(screen.queryByText(/Loading/i)).not.toBeInTheDocument();
    });

    const downloadPdfBtn = screen.getByTitle('Download PDF');
    expect(downloadPdfBtn).toBeInTheDocument();

    // Click Download PDF button
    fireEvent.click(downloadPdfBtn);

    // Verify progress overlay is rendered
    await waitFor(() => {
      expect(screen.getByText('Generating PDF Report')).toBeInTheDocument();
      expect(screen.getByText(/Processing page [1-7] of 7/i)).toBeInTheDocument();
    });

    // Wait until generation overlay finishes
    await waitFor(() => {
      expect(screen.queryByText('Generating PDF Report')).not.toBeInTheDocument();
    }, { timeout: 5000 }); // Wait longer if needed, but our mocked delay should run fast!
  });
});

describe('Color space translation unit tests', () => {
  beforeEach(() => {
    oklchCache.clear();
  });

  it('handles empty, null, or non-string inputs cleanly', () => {
    expect(resolveOklchStrings('')).toBe('');
    expect(resolveOklchStrings(null as any)).toBeNull();
    expect(resolveOklchStrings(undefined as any)).toBeUndefined();
    expect(resolveOklchStrings(123 as any)).toBe(123 as any);
  });

  it('ignores standard color formats like hex, rgb, rgba, and named colors', () => {
    expect(resolveOklchStrings('#ffffff')).toBe('#ffffff');
    expect(resolveOklchStrings('rgb(255, 255, 255)')).toBe('rgb(255, 255, 255)');
    expect(resolveOklchStrings('rgba(0, 0, 0, 0.5)')).toBe('rgba(0, 0, 0, 0.5)');
    expect(resolveOklchStrings('red')).toBe('red');
  });

  it('identifies and translates oklch and oklab functions in complex CSS statements', () => {
    // In JSDOM test runner, Canvas returns 0 alpha, so it falls back to white (rgb(255, 255, 255))
    // unless it recognizes it as transparent oklch.
    expect(resolveOklchStrings('oklch(0.5 0.2 280)')).toBe('rgb(255, 255, 255)');
    expect(resolveOklchStrings('1px solid oklch(0.5 0.2 280)')).toBe('1px solid rgb(255, 255, 255)');
    expect(resolveOklchStrings('oklab(0.5 0.2 280)')).toBe('rgb(255, 255, 255)');
  });

  it('handles transparent oklch notations by returning transparent rgba', () => {
    expect(resolveOklchStrings('oklch(0 0 0 / 0)')).toBe('rgba(0, 0, 0, 0)');
    expect(resolveOklchStrings('oklch(0 0 0 /0)')).toBe('rgba(0, 0, 0, 0)');
  });

  it('utilizes cached values for duplicate lookups to skip canvas rendering', () => {
    oklchCache.set('oklch(1 2 3)', 'rgb(10, 20, 30)');
    expect(resolveOklchStrings('oklch(1 2 3)')).toBe('rgb(10, 20, 30)');
  });
});



