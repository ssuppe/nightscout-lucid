import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import { NightscoutClient } from './nightscout';

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
});
