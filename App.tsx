import React, { useState, useEffect, useRef } from 'react';
import { Activity, Cpu, MessageSquare, TrendingUp, Globe, Terminal, Radio, BrainCircuit, Zap, Wifi, Clock, ShieldCheck } from 'lucide-react';
import CyberCard from './components/CyberCard';
import PriceChart from './components/PriceChart';
import { CandleData, SystemState, MarketAnalysis, ChatMessage, MessageRole } from './types';
import { analyzeMarketStrategy, fetchMarketHotspots, chatWithJarvis } from './services/geminiService';

const MAX_CANDLES = 120; // 2 Hours of 1m data
const ANALYSIS_INTERVAL_MS = 60000 * 5; // 5 Minutes

// --- Helper: Typewriter Text Component ---
const TypewriterText = ({ text, onComplete }: { text: string, onComplete?: () => void }) => {
  const [displayedText, setDisplayedText] = useState('');
  
  useEffect(() => {
    let index = 0;
    setDisplayedText('');
    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => prev + text.charAt(index));
        index++;
      } else {
        clearInterval(interval);
        if (onComplete) onComplete();
      }
    }, 20); // Typing speed
    return () => clearInterval(interval);
  }, [text]);

  return <span className="cursor-blink">{displayedText}</span>;
};

// --- Helper: Exponential Moving Average ---
const calculateEMA = (data: CandleData[], period: number) => {
  if (data.length < period) return Array(data.length).fill(undefined);
  
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i].close;
  let ema = sum / period;
  
  const result = Array(period - 1).fill(undefined);
  result.push(ema);

  for (let i = period; i < data.length; i++) {
    ema = data[i].close * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
};

export default function App() {
  // State
  const [candleData, setCandleData] = useState<CandleData[]>([]);
  const [currentPrice, setCurrentPrice] = useState<number>(0);
  const [systemState, setSystemState] = useState<SystemState>(SystemState.CONNECTING);
  const [analysis, setAnalysis] = useState<MarketAnalysis | null>(null);
  const [hotspots, setHotspots] = useState<{ summary: string; news: any[] }>({ summary: '', news: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: MessageRole.SYSTEM, text: 'JARVIS 核心系统初始化完成。加密链路已激活。', timestamp: Date.now() }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [dataSource, setDataSource] = useState<'Binance' | 'Coinbase' | 'None'>('None');
  const [memoryStream, setMemoryStream] = useState<string[]>([]);
  const [isLearning, setIsLearning] = useState(false);
  const [latency, setLatency] = useState<number>(0);
  const [lastPingTime, setLastPingTime] = useState<number>(Date.now());

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const candleDataRef = useRef<CandleData[]>([]);
  const currentPriceRef = useRef<number>(0);
  const analysisInProgressRef = useRef(false);
  
  // Load Consciousness on mount
  useEffect(() => {
    const savedMemory = localStorage.getItem('jarvis_memory');
    if (savedMemory) {
      setMemoryStream(JSON.parse(savedMemory));
    }
  }, []);

  // Persist Consciousness
  useEffect(() => {
    localStorage.setItem('jarvis_memory', JSON.stringify(memoryStream));
  }, [memoryStream]);

  // Keep refs synced
  useEffect(() => {
    candleDataRef.current = candleData;
    currentPriceRef.current = currentPrice;
  }, [candleData, currentPrice]);

  // WebSocket Logic - Strictly 1m K-line with Volume
  useEffect(() => {
    let fallbackTimeout: any;

    const connectCoinbase = () => {
      if (wsRef.current) wsRef.current.close();
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, text: 'Binance 链路无响应。正在重路由至 CoinBase...', timestamp: Date.now() }]);
      
      const ws = new WebSocket('wss://ws-feed.exchange.coinbase.com');
      ws.onopen = () => {
        setDataSource('Coinbase');
        ws.send(JSON.stringify({ type: "subscribe", product_ids: ["BTC-USD"], channels: ["ticker"] }));
        setSystemState(SystemState.IDLE);
      };
      ws.onmessage = (event) => {
        const now = Date.now();
        const data = JSON.parse(event.data);
        if (data.type === 'ticker' && data.price) {
          // Latency Calculation
          if (data.time) {
             const serverTime = new Date(data.time).getTime();
             setLatency(Math.max(0, now - serverTime));
          }

          const price = parseFloat(data.price);
          const time = new Date(data.time).getTime();
          const vol = parseFloat(data.volume_24h || '0') / 1440; 
          updateCurrentPrice(price);
          aggregateCandleLocally(price, time, vol);
        }
      };
      ws.onerror = (e) => {
         setSystemState(SystemState.ERROR);
      };
      wsRef.current = ws;
    };

    const connectBinance = () => {
      if (wsRef.current) wsRef.current.close();
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@kline_1m');
      
      ws.onopen = () => {
        setDataSource('Binance');
        setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.SYSTEM, text: 'Binance K-Line 1M 专用加密链路已建立。', timestamp: Date.now() }]);
        setSystemState(SystemState.IDLE);
        clearTimeout(fallbackTimeout);
      };

      ws.onmessage = (event) => {
        const now = Date.now();
        const data = JSON.parse(event.data);
        if (data.E) { // Event time
           setLatency(now - data.E);
        }

        if (data.e === 'kline') {
          const k = data.k;
          const candle: CandleData = {
            time: k.t,
            open: parseFloat(k.o),
            high: parseFloat(k.h),
            low: parseFloat(k.l),
            close: parseFloat(k.c),
            volume: parseFloat(k.v)
          };
          updateCurrentPrice(candle.close);
          updateCandles(candle);
        }
      };
      ws.onerror = () => { connectCoinbase(); };
      wsRef.current = ws;
      fallbackTimeout = setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) { connectCoinbase(); }
      }, 5000);
    };

    const updateCurrentPrice = (price: number) => { setCurrentPrice(price); };

    const updateCandles = (newCandle: CandleData) => {
      setCandleData(prev => {
        let updated = [...prev];
        const lastCandle = updated[updated.length - 1];

        if (lastCandle && lastCandle.time === newCandle.time) {
          // Update forming candle
          updated[updated.length - 1] = {
            ...newCandle,
            aiSignal: lastCandle.aiSignal // Preserve signal on current candle
          };
        } else {
          // New candle closed, push new one
          updated.push(newCandle);
        }
        
        if (updated.length > MAX_CANDLES) updated = updated.slice(updated.length - MAX_CANDLES);
        
        // Recalculate EMAs
        const ema7 = calculateEMA(updated, 7);
        const ema25 = calculateEMA(updated, 25);
        const ema99 = calculateEMA(updated, 99);
        
        updated = updated.map((c, i) => ({
          ...c,
          ema7: ema7[i],
          ema25: ema25[i],
          ema99: ema99[i]
        }));

        return updated;
      });
    };

    const aggregateCandleLocally = (price: number, time: number, vol: number) => {
      const candleTime = Math.floor(time / 60000) * 60000;
      setCandleData(prev => {
        let updated = [...prev];
        const lastCandle = updated[updated.length - 1];
        
        if (lastCandle && lastCandle.time === candleTime) {
          updated[updated.length - 1] = {
             ...lastCandle,
             high: Math.max(lastCandle.high, price),
             low: Math.min(lastCandle.low, price),
             close: price,
             volume: lastCandle.volume + (vol / 60)
          };
        } else {
          updated.push({
            time: candleTime,
            open: price,
            high: price,
            low: price,
            close: price,
            volume: vol / 60
          });
        }
        if (updated.length > MAX_CANDLES) updated = updated.slice(updated.length - MAX_CANDLES);
        
        const ema7 = calculateEMA(updated, 7);
        const ema25 = calculateEMA(updated, 25);
        const ema99 = calculateEMA(updated, 99);
        
        updated = updated.map((c, i) => ({
          ...c,
          ema7: ema7[i],
          ema25: ema25[i],
          ema99: ema99[i]
        }));

        return updated;
      });
    };

    connectBinance();
    return () => { if (wsRef.current) wsRef.current.close(); clearTimeout(fallbackTimeout); };
  }, []);

  // Analysis Logic
  const runAnalysis = async () => {
    if (analysisInProgressRef.current || candleDataRef.current.length < 10) return;
    
    analysisInProgressRef.current = true;
    setSystemState(SystemState.ANALYZING);
    setIsLearning(true);
    
    try {
      const current = currentPriceRef.current;
      const candles = candleDataRef.current.slice(-15);
      
      const trendDesc = candles.map(c => 
        `[T:${new Date(c.time).getMinutes()} O:${c.open} C:${c.close} V:${c.volume}]`
      ).join(' ');
      
      const result = await analyzeMarketStrategy(current, trendDesc, memoryStream);
      setAnalysis(result);
      
      // Stamp Signal
      setCandleData(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (lastIdx >= 0) {
          let signal: CandleData['aiSignal'] | undefined;
          if (result.sentiment.includes('看涨') || result.sentiment.includes('BULLISH')) signal = 'bullish';
          else if (result.sentiment.includes('看跌') || result.sentiment.includes('BEARISH')) signal = 'bearish';
          
          if (signal) {
             updated[lastIdx] = { ...updated[lastIdx], aiSignal: signal };
          }
        }
        return updated;
      });

      // Autonomous Learning Log
      if (result.learningNode && result.learningNode.length > 5) {
        setMemoryStream(prev => {
           const newMemory = [...prev, result.learningNode];
           return newMemory.slice(-20); 
        });
        setMessages(prev => [...prev, {
           id: Date.now().toString(),
           role: MessageRole.SYSTEM,
           text: `[自我进化] 意识节点已归档: "${result.learningNode}"`,
           timestamp: Date.now()
        }]);
      }
      
      setSystemState(SystemState.SCANNING);
      const newsResult = await fetchMarketHotspots();
      setHotspots(newsResult);

    } catch (e) {
      console.error(e);
    } finally {
      setSystemState(SystemState.IDLE);
      setIsLearning(false);
      analysisInProgressRef.current = false;
    }
  };

  useEffect(() => {
    if (!analysis && candleData.length > 10) runAnalysis();
  }, [candleData.length]);

  useEffect(() => {
    const interval = setInterval(runAnalysis, ANALYSIS_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [memoryStream]);

  // Chat
  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, text: inputMessage, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setSystemState(SystemState.PROCESSING);

    const context = `
      当前价格: ${currentPrice}
      最新策略: ${analysis?.sentiment} (${analysis?.reasoning})
      记忆节点: ${analysis?.learningNode}
    `;
    const responseText = await chatWithJarvis(inputMessage, context);

    const modelMsg: ChatMessage = { id: (Date.now() + 1).toString(), role: MessageRole.MODEL, text: responseText, timestamp: Date.now() };
    setMessages(prev => [...prev, modelMsg]);
    setSystemState(SystemState.IDLE);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messages.length]);

  const isUp = candleData.length >= 2 && candleData[candleData.length - 1].close >= candleData[candleData.length - 2].close;
  const themeText = isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]';
  
  // Dynamic Core Color
  const getCoreColor = () => {
    if (!analysis) return 'text-slate-600 border-slate-700';
    if (analysis.sentiment.includes('看涨')) return 'text-[#0ecb81] border-[#0ecb81] shadow-[0_0_30px_rgba(14,203,129,0.5)]';
    if (analysis.sentiment.includes('看跌')) return 'text-[#f6465d] border-[#f6465d] shadow-[0_0_30px_rgba(246,70,93,0.5)]';
    return 'text-cyan-500 border-cyan-500 shadow-[0_0_30px_rgba(6,182,212,0.5)]';
  };

  return (
    <div className="min-h-screen bg-[#050607] text-slate-200 sci-fi-grid flex flex-col p-2 md:p-4 overflow-hidden max-h-screen relative font-rajdhani selection:bg-cyan-500/30">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-cyan-600 to-transparent opacity-50 z-50"></div>
      
      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-3 border-b border-[#1e2329] pb-2 bg-[#050607]/90 backdrop-blur z-20 shrink-0">
        <div className="flex items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => runAnalysis()}>
            <ShieldCheck className={`w-9 h-9 transition-all duration-500 ${isLearning ? 'animate-pulse text-purple-400' : 'text-cyan-600 hover:text-cyan-400'}`} />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-[0.1em] text-white font-mono flex items-center gap-2">
              JARVIS <span className="text-[10px] text-cyan-400 font-normal tracking-[0.2em] border border-cyan-900/50 px-2 py-0.5 rounded bg-cyan-950/20">CORE v5.0 ULTIMATE</span>
            </h1>
            <div className="flex items-center gap-4 mt-1">
               <div className="flex items-center gap-1.5">
                 <span className={`w-1.5 h-1.5 rounded-full ${systemState === SystemState.IDLE ? 'bg-[#0ecb81] shadow-[0_0_8px_#0ecb81]' : 'bg-amber-500 animate-pulse'}`}></span>
                 <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">{systemState}</p>
               </div>
               <div className="flex items-center gap-1 text-[10px] text-slate-500 font-mono border-l border-[#2a2e39] pl-3">
                  <Wifi size={10} className={latency < 100 ? "text-[#0ecb81]" : "text-amber-500"} />
                  <span>PING: {latency}ms</span>
               </div>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end font-mono">
           <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border ${dataSource !== 'None' ? 'border-[#0ecb81]/30 text-[#0ecb81] bg-[#0ecb81]/5' : 'border-red-500/30 text-red-500'}`}>
                {dataSource} STREAM
              </span>
              <Clock size={12} className="text-slate-600" />
              <span className="text-[10px] text-slate-500">{new Date().toLocaleTimeString()}</span>
           </div>
           <div className="flex items-baseline gap-3">
             <span className={`text-5xl font-bold ${themeText} tracking-tighter transition-colors duration-200 drop-shadow-2xl`}>
               ${currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </span>
           </div>
        </div>
      </header>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-4 overflow-hidden min-h-0">
        
        {/* Left Column: Chart & Strategy */}
        <div className="md:col-span-9 flex flex-col gap-4 h-full min-h-0">
          
          {/* Chart Section - Maximized */}
          <CyberCard title="MARKET VISUALIZER [1M]" icon={<Activity size={16} />} className="flex-1 border-[#1e2329] shadow-[0_0_50px_rgba(0,0,0,0.3)] min-h-0">
            {candleData.length > 2 ? (
               <PriceChart data={candleData} />
            ) : (
               <div className="flex flex-col items-center justify-center h-full text-slate-600 gap-4">
                 <div className="w-16 h-16 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full animate-spin"></div>
                 <p className="text-xs font-mono tracking-[0.3em] text-cyan-500/50 animate-pulse">ESTABLISHING SECURE CONNECTION</p>
               </div>
            )}
          </CyberCard>

          {/* Bottom Panels */}
          <div className="h-[25%] min-h-[180px] grid grid-cols-1 md:grid-cols-2 gap-4">
            <CyberCard title="TACTICAL ANALYSIS" icon={<TrendingUp size={16} />} loading={systemState === SystemState.ANALYZING}>
              {analysis ? (
                <div className="h-full overflow-y-auto custom-scrollbar pr-2">
                  <div className="flex justify-between items-center mb-3">
                     <div className={`px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-[0.1em] border shadow-[0_0_15px_inset] transition-all duration-500 ${
                       analysis.sentiment.includes('看涨') ? 'bg-[#0ecb81]/5 text-[#0ecb81] border-[#0ecb81]/30 shadow-[#0ecb81]/20' : 
                       analysis.sentiment.includes('看跌') ? 'bg-[#f6465d]/5 text-[#f6465d] border-[#f6465d]/30 shadow-[#f6465d]/20' : 
                       'bg-slate-700/20 text-slate-300 border-slate-600'
                     }`}>
                       {analysis.sentiment}
                     </div>
                     <span className="text-[10px] text-slate-500 font-mono opacity-50">{new Date(analysis.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-3 text-xs font-mono">
                    <div className="bg-[#0b0e11] p-2 rounded border border-cyan-900/30 flex justify-between items-center group hover:border-cyan-500/50 transition-colors">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider">Target Entry</span>
                      <span className="text-cyan-400 font-bold group-hover:text-cyan-300">{analysis.entryPoint}</span>
                    </div>
                    <div className="bg-[#0b0e11] p-2 rounded border border-purple-900/30 flex justify-between items-center group hover:border-purple-500/50 transition-colors">
                      <span className="text-slate-500 text-[9px] uppercase tracking-wider">Target Exit</span>
                      <span className="text-purple-400 font-bold group-hover:text-purple-300">{analysis.exitPoint}</span>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-slate-700 to-transparent"></div>
                    <p className="text-xs text-slate-300 leading-relaxed pl-3 font-light tracking-wide opacity-90">
                      <TypewriterText text={analysis.reasoning} />
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-700 text-xs font-mono tracking-widest">
                   AWAITING TACTICAL DATA...
                </div>
              )}
            </CyberCard>

            <CyberCard title="INTELLIGENCE FEED" icon={<Globe size={16} />} loading={systemState === SystemState.SCANNING}>
               <div className="space-y-2 overflow-y-auto h-full custom-scrollbar pr-1">
                 {hotspots.news.map((item, idx) => (
                   <a key={idx} href={item.url} target="_blank" rel="noopener noreferrer" className="block p-2.5 bg-[#0b0e11] hover:bg-[#1e2329] rounded border border-[#1e2329] hover:border-cyan-500/30 transition-all group relative overflow-hidden">
                     <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-800 group-hover:bg-cyan-500 transition-colors"></div>
                     <div className="flex justify-between items-start pl-2">
                        <p className="text-[11px] text-slate-400 group-hover:text-cyan-100 transition-colors leading-snug">{item.title}</p>
                        <Zap size={10} className="text-slate-700 shrink-0 mt-0.5 ml-2 group-hover:text-yellow-400 transition-colors" />
                     </div>
                   </a>
                 ))}
                 {hotspots.news.length === 0 && <div className="text-center text-[10px] text-slate-700 mt-10 font-mono tracking-widest">NO EXTERNAL SIGNALS</div>}
               </div>
            </CyberCard>
          </div>
        </div>

        {/* Right Column: Chat & Core */}
        <div className="md:col-span-3 flex flex-col gap-4 h-full min-h-0">
          <CyberCard title="JARVIS TERMINAL" icon={<Terminal size={16} />} className="flex-1 flex flex-col border-[#1e2329] min-h-0">
            <div className="flex-1 overflow-y-auto space-y-4 p-2 custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === MessageRole.USER ? 'justify-end' : 'justify-start'} animate-fadeIn`}>
                  <div className={`max-w-[95%] p-2.5 rounded-sm text-xs leading-relaxed border backdrop-blur-sm shadow-lg ${
                    msg.role === MessageRole.USER 
                      ? 'bg-cyan-950/20 border-cyan-800/50 text-cyan-100 text-right' 
                      : msg.role === MessageRole.SYSTEM
                        ? 'bg-transparent border-transparent text-slate-600 font-mono text-[10px] text-center w-full tracking-widest'
                        : 'bg-[#1e2329]/90 border-[#2a2e39] text-slate-300'
                  }`}>
                    {msg.role === MessageRole.MODEL ? (
                       <TypewriterText text={msg.text} />
                    ) : (
                       msg.text
                    )}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <div className="mt-2 pt-2 border-t border-[#1e2329]">
               <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={inputMessage}
                   onChange={(e) => setInputMessage(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                   placeholder="Enter command..."
                   className="flex-1 bg-[#0b0e11] border border-[#2a2e39] rounded px-3 py-2 text-xs text-cyan-100 focus:outline-none focus:border-cyan-600 font-mono placeholder-slate-700 transition-colors shadow-inner"
                 />
                 <button 
                   onClick={handleSendMessage}
                   className="bg-[#1e2329] hover:bg-cyan-900/30 border border-[#2a2e39] hover:border-cyan-700 text-cyan-500 p-2 rounded transition-all active:scale-95"
                 >
                   <MessageSquare size={14} />
                 </button>
               </div>
            </div>
          </CyberCard>
          
          {/* Neural Core Visualization - REACTIVE */}
          <div className={`h-[180px] bg-[#050607] border rounded-xl relative overflow-hidden flex items-center justify-center group transition-all duration-1000 ${getCoreColor()}`}>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px]"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent"></div>
            
            {/* Holographic Ring Layers */}
            <div className={`absolute w-40 h-40 rounded-full border border-dashed border-current opacity-10 animate-spin-slow duration-[20s]`}></div>
            <div className={`absolute w-28 h-28 rounded-full border border-current opacity-20 animate-reverse-spin duration-[10s]`}></div>
            
            {/* Core Reactor */}
            <div className="relative z-10 flex flex-col items-center">
               <div className={`w-16 h-16 rounded-full border-2 border-current flex items-center justify-center transition-all duration-500 backdrop-blur-md shadow-[0_0_50px_currentColor] bg-black/40`}>
                  <BrainCircuit size={28} className={`transition-all duration-500 ${isLearning ? 'animate-pulse scale-110' : ''}`} />
               </div>
               
               <div className="mt-4 text-center">
                 <p className={`text-[10px] font-mono tracking-[0.3em] uppercase transition-colors font-bold`}>
                   {isLearning ? 'NEURAL EVOLUTION' : 'CORE ONLINE'}
                 </p>
                 {/* Audio Visualizer Effect */}
                 <div className="flex justify-center gap-1 mt-3 h-4 items-end">
                   {[1,2,3,4,5,6].map(i => (
                     <div key={i} className={`w-0.5 bg-current transition-all duration-100 rounded-full opacity-60`} 
                          style={{
                            height: isLearning ? `${Math.random() * 100}%` : '20%',
                            animation: isLearning ? `bounce ${0.2 + Math.random() * 0.3}s infinite alternate` : 'none'
                          }}>
                     </div>
                   ))}
                 </div>
               </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}