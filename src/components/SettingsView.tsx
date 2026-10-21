import React, { useState } from 'react';
import { AppSettings, AppTheme } from '../types';
import {
  Settings,
  Palette,
  School,
  User,
  BookOpen,
  Download,
  Upload,
  Check,
  Cpu,
  Zap,
  CheckCircle2,
  AlertCircle,
  Terminal,
  Sparkles
} from 'lucide-react';
import { DEFAULT_EMBEDDING_CONFIG } from '../utils';
import {
  testEmbeddingConnection,
  cosineSimilarity,
  getEmbedding,
  EmbeddingTestResult
} from '../services/embeddingService';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  onExportBackup: () => void;
  onImportBackup: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onExportBackup,
  onImportBackup
}) => {
  const [formData, setFormData] = useState<AppSettings>(settings);

  // Embedding testing and playground state
  const [embeddingTestResult, setEmbeddingTestResult] = useState<EmbeddingTestResult | null>(null);
  const [isTestingEmbedding, setIsTestingEmbedding] = useState(false);
  const [playgroundTextA, setPlaygroundTextA] = useState(
    'Progettazione didattica di una capriata in legno per architettura sostenibile'
  );
  const [playgroundTextB, setPlaygroundTextB] = useState(
    'Strutture reticolari, carichi meccanici e materiali biocompatibili'
  );
  const [playgroundSimilarity, setPlaygroundSimilarity] = useState<number | null>(null);
  const [isCalculatingPlayground, setIsCalculatingPlayground] = useState(false);
  const [playgroundLatency, setPlaygroundLatency] = useState<number | null>(null);

  const handleTestEmbedding = async () => {
    setIsTestingEmbedding(true);
    setEmbeddingTestResult(null);
    try {
      const cfg = formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG;
      const res = await testEmbeddingConnection(cfg);
      setEmbeddingTestResult(res);
    } catch (err: any) {
      setEmbeddingTestResult({
        success: false,
        latencyMs: 0,
        error: err.message || 'Errore imprevisto durante il test'
      });
    } finally {
      setIsTestingEmbedding(false);
    }
  };

  const handleRunPlayground = async () => {
    if (!playgroundTextA.trim() || !playgroundTextB.trim()) return;
    setIsCalculatingPlayground(true);
    const start = performance.now();
    try {
      const cfg = formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG;
      const [vecA, vecB] = await Promise.all([
        getEmbedding(playgroundTextA, cfg),
        getEmbedding(playgroundTextB, cfg)
      ]);
      const sim = cosineSimilarity(vecA, vecB);
      setPlaygroundSimilarity(sim);
      setPlaygroundLatency(Math.round(performance.now() - start));
    } catch (err: any) {
      alert(`Errore nel calcolo vettoriale: ${err.message || 'Verifica la connessione a llama-server'}`);
    } finally {
      setIsCalculatingPlayground(false);
    }
  };

  const THEMES: { id: AppTheme; label: string; bg: string; color: string }[] = [
    { id: 'cyan', label: 'Cyan Neon', bg: '#00d8d6', color: '#030712' },
    { id: 'matrix', label: 'Matrix Green', bg: '#10b981', color: '#030712' },
    { id: 'purple', label: 'Cyber Purple', bg: '#c084fc', color: '#030712' },
    { id: 'amber', label: 'Solar Amber', bg: '#fbbf24', color: '#030712' },
    { id: 'mixed', label: 'Neon Misto (Armonico)', bg: 'linear-gradient(135deg, #38bdf8, #c084fc)', color: '#ffffff' }
  ];

  const handleThemeChange = (themeId: AppTheme) => {
    const updated = { ...formData, theme: themeId };
    setFormData(updated);
    onUpdateSettings(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings(formData);
    alert('Impostazioni, motore embedding e intestazioni salvate con successo!');
  };

  return (
    <div className="space-y-4">
      {/* Institutional Profile Settings */}
      <div className="neon-card neon-card-highlight p-5">
        <div className="mb-4 pb-3 border-b border-[var(--border)]">
          <h3 className="text-lg font-bold text-[var(--primary)] drop-shadow-[0_0_8px_var(--primary)] flex items-center gap-2">
            <School className="w-5 h-5 text-[var(--primary)]" /> Impostazioni Generali & Profilo Docente
          </h3>
          <p className="text-xs text-slate-400">
            Personalizza l'intestazione ufficiale dei report per il Consiglio di Classe e gli scrutini.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Nome Istituto Scolastico
              </label>
              <input
                type="text"
                value={formData.school}
                onChange={e => setFormData({ ...formData, school: e.target.value })}
                className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                placeholder="es. I.C. Vittorio De Sanctis"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Anno Scolastico
              </label>
              <input
                type="text"
                value={formData.year}
                onChange={e => setFormData({ ...formData, year: e.target.value })}
                className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                placeholder="es. 2026/2027"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Docente Titolare
              </label>
              <input
                type="text"
                value={formData.teacher}
                onChange={e => setFormData({ ...formData, teacher: e.target.value })}
                className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                placeholder="es. Prof. Antonio Corsano"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Materia / Disciplina
              </label>
              <input
                type="text"
                value={formData.subject}
                onChange={e => setFormData({ ...formData, subject: e.target.value })}
                className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                placeholder="es. Tecnologia & Disegno"
                required
              />
            </div>
          </div>

          {/* Theme Engine */}
          <div className="pt-3 border-t border-[var(--border)]">
            <h4 className="text-xs uppercase tracking-wider font-bold text-slate-300 mb-2 flex items-center gap-1.5">
              <Palette className="w-4 h-4 text-[var(--primary)]" /> Theme Engine & Accento Luminoso Neon
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Seleziona la palette cromatica ad alta leggibilità e contrasto per l'interfaccia.
            </p>

            <div className="flex flex-wrap gap-2.5">
              {THEMES.map(th => {
                const isSelected = formData.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleThemeChange(th.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 border ${
                      isSelected ? 'ring-2 ring-white scale-105 shadow-lg' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{
                      background: th.bg,
                      color: th.color,
                      borderColor: isSelected ? '#ffffff' : 'transparent'
                    }}
                  >
                    <span>{th.label}</span>
                    {isSelected && <Check className="w-3.5 h-3.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Weighting configuration following D.M. 221/2025 */}
          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <div>
                <h4 className="text-xs uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
                  <span>⚖️ Pesi Valutazioni per Media Ponderata (D.M. 221/2025)</span>
                </h4>
                <p className="text-xs text-slate-400">
                  Definisci il peso percentuale delle diverse prove nel calcolo della media annuale e di quadrimestre.
                </p>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    const presetWeights = {
                      verifica: 100,
                      orale: 100,
                      disegno: 100,
                      test: 80,
                      osserv: 50
                    };
                    setFormData({ ...formData, evaluationWeights: presetWeights, useWeightedAverage: true });
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800 hover:bg-cyan-900/60 transition-colors"
                >
                  ⭐ Standard D.M. 221
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const equalWeights = {
                      verifica: 100,
                      orale: 100,
                      disegno: 100,
                      test: 100,
                      osserv: 100
                    };
                    setFormData({ ...formData, evaluationWeights: equalWeights, useWeightedAverage: false });
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 transition-colors"
                >
                  Tutti 100% (Aritmetica)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 my-3">
              {[
                { key: 'verifica', label: 'Verifica Scritta', def: 100 },
                { key: 'orale', label: 'Colloquio Orale', def: 100 },
                { key: 'disegno', label: 'Disegno / Pratico', def: 100 },
                { key: 'test', label: 'Test / Quiz', def: 80 },
                { key: 'osserv', label: 'Osservazione', def: 50 }
              ].map(item => {
                const currentW = (formData.evaluationWeights as any)?.[item.key] ?? item.def;
                return (
                  <div key={item.key} className="p-2.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] text-center">
                    <span className="block text-[11px] font-semibold text-slate-300 truncate mb-1">
                      {item.label}
                    </span>
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="number"
                        min={10}
                        max={200}
                        step={5}
                        value={currentW}
                        onChange={e => {
                          const val = Math.max(0, Math.min(200, Number(e.target.value)));
                          setFormData({
                            ...formData,
                            evaluationWeights: {
                              ...(formData.evaluationWeights || {
                                verifica: 100,
                                orale: 100,
                                disegno: 100,
                                test: 80,
                                osserv: 50
                              }),
                              [item.key]: val
                            }
                          });
                        }}
                        className="w-16 p-1 text-center font-bold text-xs neon-input text-white"
                      />
                      <span className="text-xs font-bold text-[var(--primary)]">%</span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="check-use-weighted"
                checked={formData.useWeightedAverage ?? true}
                onChange={e => setFormData({ ...formData, useWeightedAverage: e.target.checked })}
                className="w-4 h-4 rounded border-slate-700 text-[var(--primary)] focus:ring-[var(--primary)]"
              />
              <label htmlFor="check-use-weighted" className="text-xs text-slate-300 cursor-pointer font-medium">
                Imposta la Media Ponderata come indicatore principale per l'attribuzione dei livelli D.M. 221/2025
              </label>
            </div>
          </div>

          {/* Local Embedding Engine Configuration (Termux / llama.cpp / Ollama / Gemini) */}
          <div className="pt-4 border-t border-[var(--border)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-xs uppercase tracking-wider font-bold text-cyan-300 flex items-center gap-1.5 drop-shadow-[0_0_6px_rgba(6,182,212,0.4)]">
                  <Cpu className="w-4 h-4 text-cyan-400" /> Motore Vettoriale & Embedding Locale (Termux / llama.cpp / On-Device)
                </h4>
                <p className="text-xs text-slate-400">
                  Configura l'endpoint per calcolare embedding semantici direttamente sul tuo dispositivo (Android con Termux o PC locale) o via Cloud.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="toggle-embedding-enabled"
                  checked={formData.embeddingConfig?.enabled ?? true}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      embeddingConfig: {
                        ...(formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG),
                        enabled: e.target.checked
                      }
                    })
                  }
                  className="w-4 h-4 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                />
                <label htmlFor="toggle-embedding-enabled" className="text-xs font-semibold text-cyan-200 cursor-pointer">
                  Abilita Semantica AI
                </label>
              </div>
            </div>

            {/* Presets */}
            <div className="p-3 rounded-lg bg-slate-900/70 border border-slate-800 mb-3.5 space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Preset Rapidi di Configurazione:
              </span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const cfg = {
                      provider: 'local' as const,
                      endpointUrl: 'http://127.0.0.1:8080',
                      modelName: 'models/embeddinggemma-2.gguf',
                      apiType: 'llama.cpp' as const,
                      apiKey: '',
                      enabled: true
                    };
                    setFormData({ ...formData, embeddingConfig: cfg });
                    setEmbeddingTestResult(null);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/80 hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <span>📱 Termux (embeddinggemma-2:8080)</span>
                  <span className="text-[9px] px-1 bg-emerald-500/20 rounded text-emerald-200 font-mono">Consigliato</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cfg = {
                      provider: 'local' as const,
                      endpointUrl: 'http://localhost:11434',
                      modelName: 'nomic-embed-text',
                      apiType: 'ollama' as const,
                      apiKey: '',
                      enabled: true
                    };
                    setFormData({ ...formData, embeddingConfig: cfg });
                    setEmbeddingTestResult(null);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/70 hover:bg-amber-900/60 transition-colors"
                >
                  🦙 Ollama (localhost:11434)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cfg = {
                      provider: 'local' as const,
                      endpointUrl: 'http://localhost:1234',
                      modelName: 'text-embedding-nomic',
                      apiType: 'openai-compatible' as const,
                      apiKey: '',
                      enabled: true
                    };
                    setFormData({ ...formData, embeddingConfig: cfg });
                    setEmbeddingTestResult(null);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-purple-950/60 text-purple-300 border border-purple-800/70 hover:bg-purple-900/60 transition-colors"
                >
                  💻 LM Studio / LocalAI (localhost:1234)
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const cfg = {
                      provider: 'gemini' as const,
                      endpointUrl: 'https://generativelanguage.googleapis.com',
                      modelName: 'text-embedding-004',
                      apiType: 'openai-compatible' as const,
                      apiKey: '',
                      enabled: true
                    };
                    setFormData({ ...formData, embeddingConfig: cfg });
                    setEmbeddingTestResult(null);
                  }}
                  className="px-2.5 py-1 rounded text-[11px] font-semibold bg-cyan-950/60 text-cyan-300 border border-cyan-800/70 hover:bg-cyan-900/60 transition-colors"
                >
                  ☁️ Gemini Cloud (text-embedding-004)
                </button>
              </div>
            </div>

            {/* Provider and fields */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Provider Motore
                </label>
                <select
                  value={formData.embeddingConfig?.provider || 'local'}
                  onChange={e => {
                    const prov = e.target.value as 'local' | 'gemini';
                    setFormData({
                      ...formData,
                      embeddingConfig: {
                        ...(formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG),
                        provider: prov,
                        endpointUrl: prov === 'local' ? 'http://127.0.0.1:8080' : 'https://generativelanguage.googleapis.com',
                        modelName: prov === 'local' ? 'models/embeddinggemma-2.gguf' : 'text-embedding-004'
                      }
                    });
                    setEmbeddingTestResult(null);
                  }}
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white"
                >
                  <option value="local">Dispositivo Locale / Termux / llama.cpp</option>
                  <option value="gemini">Google Gemini Cloud (text-embedding-004)</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  URL Endpoint Vettoriale
                </label>
                <input
                  type="text"
                  value={formData.embeddingConfig?.endpointUrl ?? 'http://127.0.0.1:8080'}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      embeddingConfig: {
                        ...(formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG),
                        endpointUrl: e.target.value
                      }
                    })
                  }
                  placeholder="http://127.0.0.1:8080"
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Nome Modello GGUF / Identificativo
                </label>
                <input
                  type="text"
                  value={formData.embeddingConfig?.modelName ?? 'models/embeddinggemma-2.gguf'}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      embeddingConfig: {
                        ...(formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG),
                        modelName: e.target.value
                      }
                    })
                  }
                  placeholder="models/embeddinggemma-2.gguf"
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white font-mono"
                />
              </div>
            </div>

            {/* Optional API Key */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  API Key (Opzionale / per server protetti)
                </label>
                <input
                  type="password"
                  value={formData.embeddingConfig?.apiKey ?? ''}
                  onChange={e =>
                    setFormData({
                      ...formData,
                      embeddingConfig: {
                        ...(formData.embeddingConfig || DEFAULT_EMBEDDING_CONFIG),
                        apiKey: e.target.value
                      }
                    })
                  }
                  placeholder="Nessuna chiave richiesta su Termux (default)"
                  className="w-full p-2.5 neon-input text-xs sm:text-sm text-white font-mono"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleTestEmbedding}
                  disabled={isTestingEmbedding}
                  className="w-full p-2.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/50 text-cyan-300 font-semibold text-xs flex items-center justify-center gap-2 transition-all shadow-[0_0_12px_rgba(6,182,212,0.2)] disabled:opacity-50"
                >
                  {isTestingEmbedding ? (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400 animate-spin" />
                      <span>Verifica Connessione Vettoriale...</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-4 h-4 text-cyan-400" />
                      <span>Testa Connessione & Latenza Endpoint</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Terminal Command Note based on Termux screenshot */}
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 mb-3 flex items-start gap-2">
              <Terminal className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div className="overflow-x-auto w-full">
                <span className="text-slate-400 block mb-0.5">Comando Termux (da eseguire sul terminale dello smartphone):</span>
                <code className="text-emerald-400 select-all font-bold">
                  cd ~/llama.cpp && ./build/bin/llama-server -m models/embeddinggemma-2.gguf --embeddings --port 8080
                </code>
                <span className="text-[10px] text-slate-500 block mt-1">
                  • llama-server attiva automaticamente CORS e ascolta su 127.0.0.1:8080 per calcoli vettoriali on-device ultra-rapidi e riservati.
                </span>
              </div>
            </div>

            {/* Test result display */}
            {embeddingTestResult && (
              <div
                className={`p-3 rounded-lg border mb-3 ${
                  embeddingTestResult.success
                    ? 'bg-emerald-950/40 border-emerald-700/60 text-emerald-200'
                    : 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {embeddingTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                    )}
                    <span className="font-bold text-xs">
                      {embeddingTestResult.success
                        ? 'Motore di Embedding Connesso con Successo!'
                        : 'Impossibile Connettersi al Motore di Embedding'}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-black/40 border border-white/10">
                    ⏱️ {embeddingTestResult.latencyMs} ms
                  </span>
                </div>

                {embeddingTestResult.success ? (
                  <div className="text-[11px] space-y-1 text-emerald-300/90 font-mono">
                    <div>
                      Modello: <b>{embeddingTestResult.model}</b> | Spazio Vettoriale:{' '}
                      <b className="text-white">{embeddingTestResult.dimensions} dimensioni</b>
                    </div>
                    {embeddingTestResult.sampleVector && (
                      <div className="text-[10px] text-slate-300 truncate">
                        Coordinate di test (primi 5 float): [
                        {embeddingTestResult.sampleVector.map(v => v.toFixed(4)).join(', ')}...]
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-[11px] text-rose-300">
                    {embeddingTestResult.error}
                  </div>
                )}
              </div>
            )}

            {/* Interactive Embedding Playground: Semantic Similarity Lab */}
            <div className="p-3.5 rounded-lg bg-[var(--surface-variant)] border border-[var(--border)] mb-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-amber-400" /> Laboratorio Didattico di Similarità Semantica
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                  Cosine Similarity Test
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mb-2.5">
                Verifica in tempo reale come il modello vettoriale confronta concetti disciplinari o descrizioni di UDA.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Concetto A (es. UDA o Obiettivo)</span>
                  <textarea
                    rows={2}
                    value={playgroundTextA}
                    onChange={e => setPlaygroundTextA(e.target.value)}
                    className="w-full p-2 neon-input text-xs text-white"
                    placeholder="Testo A..."
                  />
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Concetto B (es. Prerequisito o Competenza)</span>
                  <textarea
                    rows={2}
                    value={playgroundTextB}
                    onChange={e => setPlaygroundTextB(e.target.value)}
                    className="w-full p-2 neon-input text-xs text-white"
                    placeholder="Testo B..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleRunPlayground}
                  disabled={isCalculatingPlayground || !playgroundTextA.trim() || !playgroundTextB.trim()}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {isCalculatingPlayground ? (
                    <>
                      <Zap className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                      <span>Calcolo Vettori Cosine...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Calcola Affinità Semantica</span>
                    </>
                  )}
                </button>

                {playgroundSimilarity !== null && (
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Affinità Vettoriale:</span>
                      <span
                        className={`text-sm font-bold font-mono ${
                          playgroundSimilarity >= 0.75
                            ? 'text-emerald-400'
                            : playgroundSimilarity >= 0.5
                            ? 'text-cyan-400'
                            : 'text-amber-400'
                        }`}
                      >
                        {(playgroundSimilarity * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-24 h-2 rounded-full bg-slate-800 overflow-hidden border border-slate-700">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, playgroundSimilarity * 100))}%` }}
                      />
                    </div>
                    {playgroundLatency && (
                      <span className="text-[10px] text-slate-500 font-mono">
                        {playgroundLatency}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-lg neon-btn-primary text-sm font-semibold mt-4"
          >
            Salva Profilo, Pesi, Embedding & Preferenze
          </button>
        </form>
      </div>


      {/* Backup and Restore Management Card */}
      <div className="neon-card p-5">
        <div className="mb-4 pb-3 border-b border-[var(--border)]">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Download className="w-4 h-4 text-[var(--primary)]" /> Gestione Dati & Sicurezza Locale
          </h3>
          <p className="text-xs text-slate-400">
            Tutti i tuoi registri risiedono nella memoria sicura del tuo browser. Esporta regolarmente un file JSON di backup o ripristina un salvataggio precedente.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onExportBackup}
            className="p-3 rounded-lg bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Download className="w-4 h-4 text-[var(--primary)]" />
            <span>Esporta File Backup (.json)</span>
          </button>

          <button
            type="button"
            onClick={onImportBackup}
            className="p-3 rounded-lg bg-[var(--surface-variant)] hover:bg-slate-800 text-slate-200 border border-[var(--border)] text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
            <span>Ripristina Registro da File JSON</span>
          </button>
        </div>
      </div>
    </div>
  );
};
