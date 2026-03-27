import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { Bot, Send, Loader2, Settings as SettingsIcon, X, Check } from 'lucide-react';

interface AIAssistantProps {
  algorithm: string;
  expr: string;
  iterations: any[];
}

type AIModel = 'gemini-3-flash-preview' | 'deepseek-r1';

const AIAssistant: React.FC<AIAssistantProps> = ({ algorithm, expr, iterations }) => {
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings state
  const [apiKey, setApiKey] = useState(localStorage.getItem('ai_insight_api_key') || '');
  const [selectedModel, setSelectedModel] = useState<AIModel>((localStorage.getItem('ai_insight_model') as AIModel) || 'gemini-3-flash-preview');
  const [isConfigured, setIsConfigured] = useState(!!apiKey);

  const saveSettings = () => {
    localStorage.setItem('ai_insight_api_key', apiKey);
    localStorage.setItem('ai_insight_model', selectedModel);
    setIsConfigured(true);
    setShowSettings(false);
  };

  const askAI = async () => {
    if (!apiKey) {
      setShowSettings(true);
      return;
    }

    setLoading(true);
    try {
      const lastIter = iterations.length > 0 ? iterations[iterations.length - 1] : null;
    const prompt = `
      你是一个最优化理论专家。用户正在学习无约束最优化算法。
      当前使用的算法是：${algorithm}
      目标函数是：f(x, y) = ${expr}
      迭代次数：${iterations.length}
      ${lastIter ? `
      最后一点：x=${lastIter.point.x.toFixed(4)}, y=${lastIter.point.y.toFixed(4)}
      最后函数值：${lastIter.value.toFixed(4)}
      ` : '目前尚未开始计算。'}
      
      请根据以上信息，简要分析：
      1. 该算法在这个函数上的预期表现如何？
      2. 该算法的核心原理是什么？
      3. 为什么在这个点收敛（或不收敛）？
      4. 给学习者的建议。
      
      请使用中文回答，并使用 Markdown 格式。
    `;

      if (selectedModel === 'gemini-3-flash-preview') {
        const ai = new GoogleGenAI({ apiKey });
        const result = await ai.models.generateContent({
          model: selectedModel,
          contents: prompt,
        });
        setResponse(result.text || "AI 暂时无法回答。");
      } else if (selectedModel === 'deepseek-r1') {
        // Assuming DeepSeek R1 via OpenAI-compatible API
        // For this applet, we'll use a generic fetch to a common endpoint or prompt user for one
        // Since no endpoint is specified, we'll assume a default or mock the call for now
        // but the prompt says "调用机制如下 要手工输入API-Key 接手后选择 gemini 3.0 flash 和 DEEPSEEK r1"
        // I will implement a generic fetch for DeepSeek
        const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [{ role: 'user', content: prompt }],
            stream: false
          })
        });
        
        if (!res.ok) throw new Error('DeepSeek API call failed');
        const data = await res.json();
        setResponse(data.choices[0].message.content || "DeepSeek 暂时无法回答。");
      }
    } catch (error) {
      console.error("AI Error:", error);
      setResponse("调用 AI 出错，请检查 API Key 和网络连接。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-xl border border-blue-50 relative">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Bot className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="text-xl font-bold text-gray-800">AI 洞察</h3>
        </div>
        <button 
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          title="设置大模型"
        >
          <SettingsIcon className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {showSettings && (
        <div className="absolute inset-0 bg-white z-20 rounded-2xl p-6 flex flex-col border border-blue-100 shadow-2xl">
          <div className="flex items-center justify-between mb-6">
            <h4 className="font-bold text-gray-700">模型配置</h4>
            <button onClick={() => setShowSettings(false)}><X className="w-5 h-5 text-gray-400" /></button>
          </div>
          
          <div className="space-y-4 flex-1">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">API Key</label>
              <input 
                type="password" 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="输入您的 API Key"
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-1">选择模型</label>
              <div className="grid grid-cols-1 gap-2">
                {(['gemini-3-flash-preview', 'deepseek-r1'] as AIModel[]).map(m => (
                  <button
                    key={m}
                    onClick={() => setSelectedModel(m)}
                    className={`w-full p-3 rounded-xl border text-left text-sm transition-all flex items-center justify-between ${
                      selectedModel === m ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold' : 'bg-white border-gray-200 text-gray-600'
                    }`}
                  >
                    {m === 'gemini-3-flash-preview' ? 'Gemini 3.0 Flash' : 'DeepSeek R1'}
                    {selectedModel === m && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button 
            onClick={saveSettings}
            className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold mt-4 hover:bg-blue-700 transition-colors"
          >
            确认选择
          </button>
        </div>
      )}

      {!response && !loading && (
        <div className="space-y-4">
          {iterations.length === 0 && (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center">
              <p className="text-sm text-slate-400">等待计算结果以进行深度分析...</p>
            </div>
          )}
          <button
            onClick={askAI}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2"
          >
            <Send className="w-4 h-4" />
            分析当前结果
          </button>
        </div>
      )}

      {loading && (
        <div className="flex flex-col items-center justify-center py-8 gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-gray-500 text-sm">AI 正在思考中...</p>
        </div>
      )}

      {response && (
        <div className="prose prose-blue max-w-none">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 max-h-[400px] overflow-y-auto">
            <ReactMarkdown>{response}</ReactMarkdown>
          </div>
          <button
            onClick={() => setResponse(null)}
            className="mt-4 text-sm text-blue-600 hover:underline"
          >
            重新提问
          </button>
        </div>
      )}
    </div>
  );
};

export default AIAssistant;
