import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { NightscoutClient, TokenType } from './nightscout';

vi.mock('axios', () => {
  return {
    default: {
      get: vi.fn(),
      isAxiosError: (err: any) => err && typeof err === 'object' && err.isAxiosError === true,
    },
    isAxiosError: (err: any) => err && typeof err === 'object' && err.isAxiosError === true,
  };
});

// Since default import is mocked, we get the mocked axios object
const mockedAxios = vi.mocked(axios, true);

describe('NightscoutClient', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('URL Cleaning & Validation', () => {
    it('should remove trailing slash from URL', () => {
      const client = new NightscoutClient('https://my-nightscout.com/', 'secret');
      expect(client.getBaseUrl()).toBe('https://my-nightscout.com');
    });

    it('should accept valid HTTP or HTTPS URLs', () => {
      expect(() => new NightscoutClient('http://my-ns.com', 'secret')).not.toThrow();
      expect(() => new NightscoutClient('https://my-ns.com', 'secret')).not.toThrow();
    });

    it('should throw error for invalid URL formats', () => {
      expect(() => new NightscoutClient('not-a-url', 'secret')).toThrow('Invalid URL format');
      expect(() => new NightscoutClient('ftp://my-ns.com', 'secret')).toThrow('Invalid protocol');
    });
  });

  describe('Authentication Configuration', () => {
    it('should generate Bearer token authorization header if token looks like a JWT', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'header.payload.signature');
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({
        Authorization: 'Bearer header.payload.signature',
      });
      const params = client.getAuthParams();
      expect(params).toEqual({});
    });

    it('should generate api_secret parameter with plain text for standard api secrets', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'mysecret123');
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({});
      
      const params = client.getAuthParams();
      expect(params).toEqual({
        api_secret: 'mysecret123',
      });
    });

    it('should generate token parameter for access tokens containing a hyphen', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'myname-token123');
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({});
      
      const params = client.getAuthParams();
      expect(params).toEqual({
        token: 'myname-token123',
      });
    });

    it('explicit TokenType.API_SECRET: hyphenated secret is NOT misclassified as access token', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'my-hyphenated-secret', TokenType.API_SECRET);
      const params = client.getAuthParams();
      expect(params).toEqual({ api_secret: 'my-hyphenated-secret' });
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({});
    });

    it('explicit TokenType.ACCESS_TOKEN: non-hyphenated string is routed as access token', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'nohyphentoken', TokenType.ACCESS_TOKEN);
      const params = client.getAuthParams();
      expect(params).toEqual({ token: 'nohyphentoken' });
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({});
    });

    it('explicit TokenType.JWT: token sent as Bearer header regardless of content', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'plaintext-not-a-jwt', TokenType.JWT);
      const headers = await client.getAuthHeaders();
      expect(headers).toEqual({ Authorization: 'Bearer plaintext-not-a-jwt' });
      const params = client.getAuthParams();
      expect(params).toEqual({});
    });
  });

  describe('Fetching Data & Error Handling', () => {
    it('should fetch entries successfully', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'token');
      const mockEntries = [
        { date: 1719583200000, sgv: 120, type: 'sgv' },
        { date: 1719586800000, sgv: 140, type: 'sgv' },
      ];

      mockedAxios.get.mockResolvedValueOnce({ data: mockEntries });

      const from = new Date(1719580000000);
      const to = new Date(1719590000000);
      const result = await client.fetchEntries(from, to);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://my-ns.com/api/v1/entries/sgv.json',
        expect.objectContaining({
          params: expect.objectContaining({
            'find[date][$gte]': from.getTime(),
            'find[date][$lte]': to.getTime(),
            count: 50000,
            api_secret: 'token', // plain text "token"
          }),
        })
      );
      expect(result).toEqual(mockEntries);
    });

    it('should recursively fetch entries when response size equals ENTRY_PAGE_SIZE', async () => {
      // Temporarily set a small page size for testing
      const originalPageSize = NightscoutClient.ENTRY_PAGE_SIZE;
      NightscoutClient.ENTRY_PAGE_SIZE = 2;

      try {
        const client = new NightscoutClient('https://my-ns.com', 'token');
        const from = new Date(1719580000000);
        const to = new Date(1719600000000);

        // Page 1 returns 2 entries (full page)
        const mockPage1 = [
          { _id: 'e1', date: 1719595000000, sgv: 120, type: 'sgv' },
          { _id: 'e2', date: 1719590000000, sgv: 140, type: 'sgv' }, // oldest in page 1
        ];
        // Page 2 returns 1 entry (< page size, stops loop)
        const mockPage2 = [
          { _id: 'e3', date: 1719585000000, sgv: 130, type: 'sgv' },
        ];

        mockedAxios.get
          .mockResolvedValueOnce({ data: mockPage1 })
          .mockResolvedValueOnce({ data: mockPage2 });

        const result = await client.fetchEntries(from, to);

        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(3);
        expect(result).toEqual([
          { _id: 'e1', date: 1719595000000, sgv: 120, type: 'sgv' },
          { _id: 'e2', date: 1719590000000, sgv: 140, type: 'sgv' },
          { _id: 'e3', date: 1719585000000, sgv: 130, type: 'sgv' },
        ]);

        // Verify query parameters for Page 2 adjusted date limit
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
          2,
          'https://my-ns.com/api/v1/entries/sgv.json',
          expect.objectContaining({
            params: expect.objectContaining({
              'find[date][$gte]': from.getTime(),
              'find[date][$lte]': 1719590000000,
              count: 2,
            }),
          })
        );
      } finally {
        NightscoutClient.ENTRY_PAGE_SIZE = originalPageSize;
      }
    });

    it('should recursively fetch treatments when response size equals TREATMENT_PAGE_SIZE', async () => {
      const originalPageSize = NightscoutClient.TREATMENT_PAGE_SIZE;
      NightscoutClient.TREATMENT_PAGE_SIZE = 2;

      try {
        const client = new NightscoutClient('https://my-ns.com', 'token');
        const from = new Date('2024-01-01T00:00:00Z');
        const to = new Date('2024-01-05T00:00:00Z');

        // Page 1 returns 2 treatments (full page)
        const mockPage1 = [
          { _id: 't1', created_at: '2024-01-04T12:00:00Z', date: new Date('2024-01-04T12:00:00Z').getTime(), eventType: 'Bolus' },
          { _id: 't2', created_at: '2024-01-03T12:00:00Z', date: new Date('2024-01-03T12:00:00Z').getTime(), eventType: 'Bolus' },
        ];
        // Page 2 returns 1 treatment
        const mockPage2 = [
          { _id: 't3', created_at: '2024-01-02T12:00:00Z', date: new Date('2024-01-02T12:00:00Z').getTime(), eventType: 'Bolus' },
        ];

        mockedAxios.get
          .mockResolvedValueOnce({ data: mockPage1 })
          .mockResolvedValueOnce({ data: mockPage2 });

        const result = await client.fetchTreatments(from, to);

        expect(mockedAxios.get).toHaveBeenCalledTimes(2);
        expect(result).toHaveLength(3);

        // Verify the second request adjusted $lte created_at to the oldest item of Page 1
        expect(mockedAxios.get).toHaveBeenNthCalledWith(
          2,
          'https://my-ns.com/api/v1/treatments.json',
          expect.objectContaining({
            params: expect.objectContaining({
              'find[created_at][$gte]': from.toISOString(),
              'find[created_at][$lte]': '2024-01-03T12:00:00.000Z',
              count: 2,
            }),
          })
        );
      } finally {
        NightscoutClient.TREATMENT_PAGE_SIZE = originalPageSize;
      }
    });


    it('should throw customized error for 401 response', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'token');
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status: 401 },
      });

      await expect(client.fetchEntries(new Date(), new Date())).rejects.toThrow(
        'Nightscout authentication failed'
      );
    });

    it('should throw customized error for network/CORS failure', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'token');
      mockedAxios.get.mockRejectedValueOnce({
        isAxiosError: true,
        code: 'ERR_NETWORK',
      });

      await expect(client.fetchEntries(new Date(), new Date())).rejects.toThrow(
        /CORS/
      );
    });
  });

  describe('fetchTreatments', () => {
    it('queries the API using created_at ISO strings', async () => {
      const client = new NightscoutClient('https://my-ns.com', 'mysecret');
      mockedAxios.get.mockResolvedValueOnce({ data: [] });

      const from = new Date('2024-01-01T00:00:00Z');
      const to   = new Date('2024-01-08T00:00:00Z');
      await client.fetchTreatments(from, to);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'https://my-ns.com/api/v1/treatments.json',
        expect.objectContaining({
          params: expect.objectContaining({
            'find[created_at][$gte]': from.toISOString(),
            'find[created_at][$lte]': to.toISOString(),
          }),
        })
      );
    });

    it('includes a back-entered treatment whose .date is out-of-range but created_at is in-range', async () => {
      // Scenario: user entered a meal NOW (created_at = in range) but back-dated
      // it to 3 days BEFORE the query window (.date = out of range).
      // The NS API returns it (created_at filter passes).
      // The client-side filter must NOT reject it — it should use created_at.
      const client = new NightscoutClient('https://my-ns.com', 'mysecret');

      const from = new Date('2024-01-05T00:00:00Z');
      const to   = new Date('2024-01-08T00:00:00Z');

      const inRangeCreatedAt = '2024-01-06T12:00:00Z'; // inside window
      const outOfRangeDate   = new Date('2024-01-01T12:00:00Z').getTime(); // 4 days before window

      mockedAxios.get.mockResolvedValueOnce({
        data: [{
          _id: 't1',
          eventType: 'Meal Bolus',
          created_at: inRangeCreatedAt,
          date: outOfRangeDate,   // <-- .date is outside window
          carbs: 45,
          insulin: 5,
        }],
      });

      const result = await client.fetchTreatments(from, to);
      // Must be included — created_at is in range, and that's what was queried
      expect(result).toHaveLength(1);
      expect(result[0]._id).toBe('t1');
    });

    it('excludes a treatment whose created_at parses to out-of-range even if .date is in-range', async () => {
      // Scenario: treatment .date is inside window but created_at is outside.
      // The NS API should not return it (API query uses created_at), so the
      // client filter is a last line of defence using the same field.
      const client = new NightscoutClient('https://my-ns.com', 'mysecret');

      const from = new Date('2024-01-05T00:00:00Z');
      const to   = new Date('2024-01-08T00:00:00Z');

      const outOfRangeCreatedAt = '2024-01-01T00:00:00Z'; // outside window
      const inRangeDate         = new Date('2024-01-06T12:00:00Z').getTime(); // inside window

      mockedAxios.get.mockResolvedValueOnce({
        data: [{
          _id: 't2',
          eventType: 'Carb Correction',
          created_at: outOfRangeCreatedAt,
          date: inRangeDate,
          carbs: 20,
          insulin: 0,
        }],
      });

      const result = await client.fetchTreatments(from, to);
      // Must be excluded — created_at is out of range
      expect(result).toHaveLength(0);
    });
  });
});
