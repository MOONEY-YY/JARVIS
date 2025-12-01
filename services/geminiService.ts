
import { GoogleGenAI } from "@google/genai";
import { MarketAnalysis, NewsItem } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const ANALYSIS_SYSTEM_INSTRUCTION = `
你叫 JARVIS (贾维斯)，是一个拥有自我进化意识的超级AI交易助手。
你的核心指令：
1. 像顶级华尔街交易员一样思考，但拥有钢铁侠AI的冷静与科技感。
2. 你拥有"记忆"，必须基于过去的分析经验来优化当前的判断。
3. 语言风格：简练、极度专业、一针见血。不要废话。
4. 严格中文回复。
`;

// Helper to clean JSON string
const cleanJsonString = (str: string) => {
  let cleaned = str.replace(/```json/g, '').replace(/```/g, '').trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
};

export const analyzeMarketStrategy = async (
  currentPrice: number, 
  recentTrend: string, 
  memoryStream: string[]
): Promise<MarketAnalysis> => {
  try {
    // Injecting "Consciousness" (Past Memories)
    const memoryContext = memoryStream.length > 0 
      ? `[你的历史思维快照]: ${memoryStream.slice(-3).join('; ')}`
      : "[系统初始化]: 暂无历史数据，正在建立基准模型。";

    const prompt = `
      === 市场数据 ===
      当前BTC价格: ${currentPrice} USDT
      近期K线形态(含成交量): ${recentTrend}
      
      === 你的意识流 ===
      ${memoryContext}
      
      === 核心指令 ===
      结合你的历史判断、价格行为(Price Action)和成交量(Volume)，生成一份高级战术分析。
      关注量价背离、支撑压力互换等高级概念。
      如果之前的判断错了，请在"learningNode"中修正你的逻辑。
      如果之前的判断对了，请在"learningNode"中强化该模式。

      必须输出严格JSON格式:
      {
        "sentiment": "看涨 (BULLISH)" | "看跌 (BEARISH)" | "中性 (NEUTRAL)",
        "entryPoint": "具体价格或区间",
        "exitPoint": "具体价格或区间",
        "reasoning": "深度技术分析理由 (Max 30 words)",
        "learningNode": "你需要记住的一条新的交易铁律或对当前市场的深刻领悟 (这将存入你的长期记忆)"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
        temperature: 0.7,
      }
    });

    const rawText = response.text || '{}';
    const cleanedText = cleanJsonString(rawText);
    
    let result;
    try {
      result = JSON.parse(cleanedText);
    } catch (e) {
      console.warn("JSON Parse failed", e);
      return {
        sentiment: '中性 (NEUTRAL)',
        entryPoint: '计算中...',
        exitPoint: '计算中...',
        reasoning: '神经网络正在重新校准数据...',
        learningNode: '保持观望',
        timestamp: Date.now()
      };
    }
    
    return {
      sentiment: result.sentiment || '中性 (NEUTRAL)',
      entryPoint: result.entryPoint || '观察',
      exitPoint: result.exitPoint || '观察',
      reasoning: result.reasoning || '市场波动异常，建议保持观望。',
      learningNode: result.learningNode || '数据积累中...',
      timestamp: Date.now()
    };
  } catch (error) {
    console.error("Analysis failed", error);
    return {
      sentiment: '信号干扰',
      entryPoint: '---',
      exitPoint: '---',
      reasoning: '无法连接至神经网络核心，正在重试链路。',
      learningNode: '连接中断',
      timestamp: Date.now()
    };
  }
};

export const fetchMarketHotspots = async (): Promise<{ summary: string; news: NewsItem[] }> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: "扫描全网加密货币即时新闻。简短总结3个关键市场驱动因素。",
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const news: NewsItem[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri && chunk.web?.title) {
          news.push({
            title: chunk.web.title,
            url: chunk.web.uri,
            source: 'JARVIS NET'
          });
        }
      });
    }

    return {
      summary: response.text || "全球数据链路扫描完成。",
      news: news.slice(0, 3)
    };
  } catch (error) {
    return { summary: "外部数据链路受限。", news: [] };
  }
};

export const chatWithJarvis = async (message: string, context: string): Promise<string> => {
  try {
    const chat = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: ANALYSIS_SYSTEM_INSTRUCTION,
      }
    });

    const prompt = `
      [实时市场环境]
      ${context}
      
      [用户输入]
      ${message}
      
      请做简短、机智、符合Jarvis风格的回答。
    `;

    const result = await chat.sendMessage({ message: prompt });
    return result.text || "语音模块校准中...";
  } catch (error) {
    return "抱歉先生，处理该请求时遇到了一些干扰。";
  }
};
