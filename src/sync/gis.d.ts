// Minimal ambient types for Google Identity Services (GIS) token flow. Loaded at runtime
// from https://accounts.google.com/gsi/client — we only use the OAuth token client.

export interface GisTokenResponse {
  access_token: string;
  expires_in: number;
  token_type?: string;
  scope?: string;
  error?: string;
}

export interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void;
}

export interface GisTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GisTokenResponse) => void;
  error_callback?: (err: { type?: string; message?: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: GisTokenClientConfig): GisTokenClient;
        };
      };
    };
  }
}
