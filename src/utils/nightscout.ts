import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

export interface NightscoutEntry {
  _id: string;
  date: number;
  sgv: number;
  type: string;
  units?: string;
  direction?: string;
}

export interface NightscoutTreatment {
  _id: string;
  date: number;
  created_at: string;
  eventType: string;
  notes?: string;
  carbs?: number | null;
  insulin?: number | null;
}

export interface TimeValue {
  time: string;
  timeAsSeconds: number;
  value: number;
}

export interface NSProfileSettings {
  dia: number;
  carbratio: TimeValue[];
  sens: TimeValue[];
  basal: TimeValue[];
  target_low: TimeValue[];
  target_high: TimeValue[];
  units: string;
  timezone: string;
}

export interface NightscoutProfile {
  _id: string;
  defaultProfile: string;
  startDate: string;
  store: Record<string, NSProfileSettings>;
  date: number;
  created_at: string;
}

export enum GlucoseUnit {
  MGDL = 'mg/dL',
  MMOL = 'mmol/L',
}

/**
 * Explicit token type — avoids misclassifying hyphenated API secrets as
 * Nightscout Access Tokens. Defaults to AUTO for backward compatibility.
 */
export enum TokenType {
  /** Heuristic: infer from token content (legacy behaviour). */
  AUTO = 'auto',
  /** Plain-text API secret — sent as `api_secret=` query param. */
  API_SECRET = 'api_secret',
  /** Nightscout Access Token (subject-hash) — sent as `token=` query param. */
  ACCESS_TOKEN = 'access_token',
  /** JWT — sent as `Authorization: Bearer` header. */
  JWT = 'jwt',
}

export class NightscoutClient {
  private baseUrl: string;
  private token: string;
  private tokenType: TokenType;

  constructor(url: string, token: string, tokenType: TokenType = TokenType.AUTO) {
    this.validateUrl(url);
    // Remove trailing slash if present
    this.baseUrl = url.replace(/\/$/, '');
    this.token = token;
    this.tokenType = tokenType;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private validateUrl(url: string): void {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      throw new Error('Invalid URL format');
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid protocol: must be http or https');
    }
  }

  public getAuthParams(): Record<string, string> {
    if (this.baseUrl.includes('/api/nurse')) {
      return {};
    }
    // Explicit type takes priority over heuristic
    const effectiveType = this.resolveTokenType();
    if (effectiveType === TokenType.API_SECRET) {
      return { api_secret: this.token };
    }
    if (effectiveType === TokenType.ACCESS_TOKEN) {
      return { token: this.token };
    }
    // JWT is handled via header
    return {};
  }

  public async getAuthHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};
    if (this.baseUrl.includes('/api/nurse')) {
      headers['X-Nurse-Access-Code'] = this.token;
      return headers;
    }
    const effectiveType = this.resolveTokenType();
    if (effectiveType === TokenType.JWT) {
      return { Authorization: `Bearer ${this.token}` };
    }
    return {};
  }

  /**
   * Resolves the effective TokenType. When AUTO, falls back to the legacy
   * heuristic (dots → JWT, hyphen → ACCESS_TOKEN, otherwise → API_SECRET).
   */
  private resolveTokenType(): TokenType {
    if (this.tokenType !== TokenType.AUTO) {
      return this.tokenType;
    }
    if (!this.token) return TokenType.API_SECRET;
    if (this.token.includes('.')) return TokenType.JWT;
    if (this.token.includes('-')) return TokenType.ACCESS_TOKEN;
    return TokenType.API_SECRET;
  }

  private async fetch<T>(
    endpoint: string,
    params: Record<string, string | number> = {},
  ): Promise<T> {
    const headers = await this.getAuthHeaders();
    const authParams = this.getAuthParams();
    const config: AxiosRequestConfig = {
      headers: headers,
      params: { ...params, ...authParams },
      timeout: 30000,
    };

    try {
      const response = await axios.get<T>(`${this.baseUrl}${endpoint}`, config);
      return response.data;
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new Error('Nightscout authentication failed');
        }
        if (error.code === 'ERR_NETWORK' || !error.response) {
          throw new Error(
            'Network error: Please verify your Nightscout URL and ensure CORS is enabled. Nightscout requires CORS_ALLOW_ORIGIN=* configuration to allow browser access.'
          );
        }
      }
      throw new Error(error?.message || 'Network error');
    }
  }

  public async fetchEntries(from: Date, to: Date): Promise<NightscoutEntry[]> {
    const fromTime = from.getTime();
    const toTime = to.getTime();

    const entries = await this.fetch<NightscoutEntry[]>(
      '/api/v1/entries/sgv.json',
      {
        'find[date][$gte]': fromTime,
        'find[date][$lte]': toTime,
        count: 50000,
      },
    );

    return entries.filter((entry) => entry.date >= fromTime && entry.date <= toTime);
  }

  public async fetchTreatments(from: Date, to: Date): Promise<NightscoutTreatment[]> {
    const fromTime = from.getTime();
    const toTime = to.getTime();

    const treatments = await this.fetch<NightscoutTreatment[]>(
      '/api/v1/treatments.json',
      {
        'find[created_at][$gte]': from.toISOString(),
        'find[created_at][$lte]': to.toISOString(),
        count: 10000,
      },
    );

    return treatments.filter((treatment) => {
      const date = treatment.date || new Date(treatment.created_at).getTime();
      return date >= fromTime && date <= toTime;
    });
  }

  public async fetchProfile(): Promise<NightscoutProfile[]> {
    return this.fetch<NightscoutProfile[]>('/api/v1/profile');
  }
}
