export interface StreamConfig {
  sampleRate: number;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

export interface MultimodalLog {
  date: Date;
  role: 'user' | 'model' | 'system';
  text: string;
}
