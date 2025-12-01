import React, { useState, useEffect } from 'react';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Scatter, ReferenceLine } from 'recharts';
import { CandleData } from '../types';

interface PriceChartProps {
  data: CandleData[];
}

const PriceChart: React.FC<PriceChartProps> = ({ data }) => {
  const [countdown, setCountdown] = useState<string>('');

  // Binance Professional Colors
  const COLOR_UP = '#0ecb81';
  const COLOR_DOWN = '#f6465d';

  // Calculate Candle Countdown (Assuming 1m candles)
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      const secondsLeft = 60 - now.getSeconds();
      setCountdown(`00:${secondsLeft.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!data || data.length === 0) return null;

  const lastCandle = data[data.length - 1];
  const currentPrice = lastCandle ? lastCandle.close : 0;
  const isLastUp = lastCandle ? lastCandle.close >= lastCandle.open : true;

  // Pre-process data for Recharts
  const processedData = data.map(item => {
    const isUp = (item.close || 0) >= (item.open || 0);
    const color = isUp ? COLOR_UP : COLOR_DOWN;
    
    // Signal positioning
    let signalY = undefined;
    if (item.aiSignal === 'bullish') signalY = item.low * 0.9990;
    if (item.aiSignal === 'bearish') signalY = item.high * 1.0010;

    // Handle Doji for visual clarity
    let open = item.open || 0;
    let close = item.close || 0;
    if (Math.abs(open - close) < 0.000001) {
      close = open + 0.01; 
    }

    return {
      ...item,
      // Recharts Bar Range: [min, max]
      wick: [item.low, item.high],
      body: [Math.min(open, close), Math.max(open, close)],
      color,
      signalY,
      volumeColor: isUp ? 'rgba(14, 203, 129, 0.4)' : 'rgba(246, 70, 93, 0.4)'
    };
  });

  const formatXAxis = (tick: number) => {
    return new Date(tick).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatYAxis = (tick: number) => {
    return tick.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Custom Shape for AI Signals
  const SignalShape = (props: any) => {
    const { cx, cy, payload } = props;
    if (!payload.aiSignal) return null;

    const isBull = payload.aiSignal === 'bullish';
    const color = isBull ? '#0ecb81' : '#f6465d';

    return (
      <g transform={`translate(${cx}, ${cy})`}>
        <circle r="4" fill={color} fillOpacity="0.2">
          <animate attributeName="r" values="4;12;4" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
        </circle>
        <path 
          d={isBull ? "M0 6 L-4 12 L4 12 Z" : "M0 -6 L-4 -12 L4 -12 Z"} 
          fill={color} 
        />
      </g>
    );
  };

  // Professional Custom Tooltip
  const CustomTooltip = ({ active, payload, coordinate }: any) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      const isUp = d.close >= d.open;
      const colorClass = isUp ? 'text-[#0ecb81]' : 'text-[#f6465d]';
      const change = d.close - d.open;
      const changePercent = (change / d.open) * 100;

      return (
        <div className="bg-[#0b0e11]/95 border border-[#2a2e39] p-3 rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.8)] text-xs font-mono backdrop-blur-xl min-w-[240px] z-50">
          <div className="flex justify-between items-center mb-3 border-b border-[#2a2e39] pb-2">
            <span className="text-slate-400 font-bold tracking-wider">{new Date(d.time).toLocaleTimeString()}</span>
            <span className={`${colorClass} font-bold text-sm bg-opacity-10 px-1 rounded`}>
              {changePercent > 0 ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 mb-3">
             <div className="flex justify-between"><span className="text-slate-500">O</span> <span className={colorClass}>{d.open.toFixed(2)}</span></div>
             <div className="flex justify-between"><span className="text-slate-500">H</span> <span className={colorClass}>{d.high.toFixed(2)}</span></div>
             <div className="flex justify-between"><span className="text-slate-500">L</span> <span className={colorClass}>{d.low.toFixed(2)}</span></div>
             <div className="flex justify-between"><span className="text-slate-500">C</span> <span className={colorClass}>{d.close.toFixed(2)}</span></div>
          </div>

          <div className="flex justify-between py-1.5 border-t border-[#2a2e39]/50">
             <span className="text-slate-500">Vol</span>
             <span className="text-slate-200 font-bold">{d.volume?.toFixed(4)}</span>
          </div>

          <div className="mt-2 pt-2 border-t border-[#2a2e39] space-y-1 text-[10px]">
             <div className="flex justify-between items-center"><span className="text-[#eab308] font-bold">EMA(7)</span> <span>{d.ema7?.toFixed(2)}</span></div>
             <div className="flex justify-between items-center"><span className="text-[#a855f7] font-bold">EMA(25)</span> <span>{d.ema25?.toFixed(2)}</span></div>
             <div className="flex justify-between items-center"><span className="text-[#3b82f6] font-bold">EMA(99)</span> <span>{d.ema99?.toFixed(2)}</span></div>
          </div>
          
          {d.aiSignal && (
            <div className={`mt-3 text-center font-bold border border-current rounded px-2 py-1.5 tracking-widest text-[10px] animate-pulse ${d.aiSignal === 'bullish' ? 'text-[#0ecb81] bg-[#0ecb81]/10' : 'text-[#f6465d] bg-[#f6465d]/10'}`}>
              // JARVIS STRATEGY: {d.aiSignal.toUpperCase()} //
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="w-full h-full min-h-[300px] select-none relative group">
      {/* Candle Countdown Overlay */}
      <div className="absolute top-2 left-2 z-10 font-mono text-xs text-slate-500 bg-[#0b0e11]/60 px-2 py-1 rounded border border-[#2a2e39] flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
        CLOSING IN: <span className="text-cyan-400 font-bold">{countdown}</span>
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={processedData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
            </linearGradient>
          </defs>
          
          <CartesianGrid strokeDasharray="3 3" stroke="#1e2329" vertical={true} horizontal={true} opacity={0.5} />
          
          <XAxis 
            dataKey="time" 
            tickFormatter={formatXAxis} 
            stroke="#475569" 
            tick={{fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b'}}
            minTickGap={50}
            axisLine={false}
            tickLine={false}
            dy={8}
            height={20}
          />
          
          {/* Price Axis */}
          <YAxis 
            yAxisId="price"
            domain={['dataMin - 20', 'dataMax + 20']} 
            tickFormatter={formatYAxis} 
            stroke="#475569" 
            tick={{fontSize: 9, fontFamily: 'JetBrains Mono', fill: '#64748b'}}
            orientation="right"
            width={55}
            axisLine={false}
            tickLine={false}
            scale="linear"
            allowDecimals={false}
          />

          {/* Volume Axis (Hidden) */}
          <YAxis 
            yAxisId="volume"
            domain={[0, 'dataMax * 5']} 
            orientation="left"
            width={0}
            axisLine={false}
            tick={false}
          />

          <Tooltip 
            content={<CustomTooltip />} 
            cursor={{ stroke: '#cbd5e1', strokeDasharray: '3 3', strokeWidth: 1, opacity: 0.5 }} 
            isAnimationActive={false}
            offset={20}
          />
          
          {/* Current Price Line */}
          <ReferenceLine 
            yAxisId="price" 
            y={currentPrice} 
            stroke={isLastUp ? "#0ecb81" : "#f6465d"} 
            strokeDasharray="3 3" 
            strokeOpacity={0.8}
          >
          </ReferenceLine>

          {/* Volume Bars */}
          <Bar dataKey="volume" yAxisId="volume" barSize={3} isAnimationActive={false}>
            {processedData.map((entry, index) => (
              <Cell key={`vol-${index}`} fill={entry.volumeColor} />
            ))}
          </Bar>

          {/* EMA Lines - Smooth & Anti-aliased look */}
          <Line yAxisId="price" type="monotone" dataKey="ema99" stroke="#3b82f6" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeOpacity={0.8} />
          <Line yAxisId="price" type="monotone" dataKey="ema25" stroke="#a855f7" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeOpacity={0.8} />
          <Line yAxisId="price" type="monotone" dataKey="ema7" stroke="#eab308" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeOpacity={0.8} />

          {/* Candle Wicks */}
          <Bar yAxisId="price" dataKey="wick" barSize={1.5} isAnimationActive={false}>
            {processedData.map((entry, index) => (
              <Cell key={`wick-${index}`} fill={entry.color} />
            ))}
          </Bar>
          
          {/* Candle Bodies */}
          <Bar yAxisId="price" dataKey="body" barSize={6} isAnimationActive={false}>
             {processedData.map((entry, index) => (
              <Cell key={`body-${index}`} fill={entry.color} />
            ))}
          </Bar>

          {/* AI Signals */}
          <Scatter yAxisId="price" dataKey="signalY" shape={<SignalShape />} isAnimationActive={false} />

        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PriceChart;