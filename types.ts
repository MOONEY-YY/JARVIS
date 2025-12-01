
export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number; // Added Volume
  // Computed indicators
  ema7?: number;
  ema25?: number;
  ema99?: number;
  // AI Sentiment Signal
  aiSignal?: 'bullish' | 'bearish';
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  isThinking?: boolean;
}

export interface MarketAnalysis {
  sentiment: '看涨 (BULLISH)' | '看跌 (BEARISH)' | '中性 (NEUTRAL)' | '信号干扰';
  entryPoint: string;
  exitPoint: string;
  reasoning: string;
  learningNode: string; 
  timestamp: number;
}

export interface NewsItem {
  title: string;
  url: string;
  source: string;
}

export enum SystemState {
  IDLE = '系统待机中',
  ANALYZING = '正在分析盘面数据...',
  PROCESSING = '神经网络计算中...',
  SCANNING = '全网情报扫描中...',
  CONNECTING = '正在建立安全连接...',
  ERROR = '连接中断'
}
