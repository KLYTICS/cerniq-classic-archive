'use client';

import { useState, useCallback } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { fetchWithAppAuth } from '@/lib/auth-fetch';
import { unwrapApiData } from '@/lib/api-response';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { MessageSquare, AlertTriangle, Send } from 'lucide-react';

interface AnalystChartDatum {
  metric: string;
  value: number;
}

interface AnalystMessage {
  role: 'user' | 'assistant';
  content: string;
  chartType?: string;
  chartData?: AnalystChartDatum[];
}

const QUICK_PROMPTS_EN = [
  'What happens to NII if rates rise 150bps?',
  'Are we ready for the next COSSEC exam?',
  'Show me our concentration risks',
  'How does our NIM compare to peers?',
  'Run a Monte Carlo with 10K paths',
  'What are upcoming regulatory deadlines?',
];
const QUICK_PROMPTS_ES = [
  '¿Qué pasa con NII si tasas suben 150bps?',
  '¿Estamos listos para el examen COSSEC?',
  'Muéstrame riesgos de concentración',
  '¿Cómo se compara nuestro NIM con pares?',
  'Ejecuta Monte Carlo con 10K senderos',
  '¿Cuáles son las fechas límite regulatorias?',
];

export default function AnalystPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [messages, setMessages] = useState<AnalystMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = useCallback(async (text: string) => {
    if (!selectedId || !text.trim()) return;
    const userMsg: AnalystMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetchWithAppAuth(`/api/alm/${selectedId}/analyst/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, sessionId: `session-${selectedId}`, lang: locale }),
      });
      if (res.ok) {
        const data = unwrapApiData<{ message?: AnalystMessage }>(await res.json());
        if (!data?.message) {
          throw new Error('Invalid analyst response payload');
        }
        setMessages(prev => [...prev, data.message]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: locale === 'es' ? 'Error al procesar la consulta. Intente de nuevo.' : 'Error processing query. Please try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: locale === 'es' ? 'Servicio no disponible. Mostrando datos de demostración.' : 'Service unavailable. Showing demo data.' }]);
    } finally { setLoading(false); }
  }, [selectedId, locale]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;

  const prompts = locale === 'es' ? QUICK_PROMPTS_ES : QUICK_PROMPTS_EN;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] max-w-[1000px] mx-auto p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-200 bg-purple-50">
          <MessageSquare className="h-4 w-4 text-purple-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Analista ALM Conversacional' : 'Conversational ALM Analyst'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? '16 herramientas CERNIQ — pregunte en lenguaje natural' : '16 CERNIQ tools — ask in natural language'}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 mb-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm text-slate-500">{locale === 'es' ? 'Haga una pregunta sobre su balance general' : 'Ask a question about your balance sheet'}</p>
            <div className="flex flex-wrap justify-center gap-2 mt-4">
              {prompts.map((p, i) => (
                <button key={i} onClick={() => sendMessage(p)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 hover:border-purple-300 hover:bg-purple-50 transition">
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 ${msg.role === 'user' ? 'bg-purple-600 text-white' : 'bg-white border border-slate-200 text-slate-800'}`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br/>')
              }} />
              {msg.chartData && msg.chartType === 'bar' && (
                <div className="mt-3 -mx-2">
                  <ResponsiveContainer width="100%" height={150}>
                    <BarChart data={msg.chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="metric" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip contentStyle={{ borderRadius: 8, fontSize: 11 }} />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {msg.chartData.map((entry, j) => (
                          <Cell key={j} fill={entry.value >= 0 ? '#10b981' : '#ef4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex gap-1"><div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce" /><div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.2s]" /><div className="h-2 w-2 rounded-full bg-purple-400 animate-bounce [animation-delay:0.4s]" /></div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage(input)}
          placeholder={locale === 'es' ? 'Pregunte sobre su balance...' : 'Ask about your balance sheet...'}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-purple-400 focus:ring-1 focus:ring-purple-300"
        />
        <button onClick={() => sendMessage(input)} disabled={loading || !input.trim()}
          className="rounded-xl bg-purple-600 px-4 py-3 text-white transition hover:bg-purple-700 disabled:opacity-50">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
