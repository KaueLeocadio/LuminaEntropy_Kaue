/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, Image as ImageIcon, Info, BarChart3, AlertCircle, CheckCircle2, Info as InfoIcon, ShieldCheck, Activity, LayoutGrid, Shield, Lock, Zap, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AnalysisResults {
  histogram: number[];
  entropy: number;
  mean: number;
  stdDev: number;
  skewness: number;
  entropyRatio: number;
  totalPixels: number;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'analyzer' | 'guide'>('analyzer');
  const [image, setImage] = useState<string | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const analyzeImage = useCallback((imgElement: HTMLImageElement) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    // Use a reasonable size for analysis to keep it fast
    const MAX_SIZE = 800;
    let width = imgElement.naturalWidth;
    let height = imgElement.naturalHeight;

    if (width > height) {
      if (width > MAX_SIZE) {
        height *= MAX_SIZE / width;
        width = MAX_SIZE;
      }
    } else {
      if (height > MAX_SIZE) {
        width *= MAX_SIZE / height;
        height = MAX_SIZE;
      }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(imgElement, 0, 0, width, height);

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const totalPixels = width * height;
    const histogram = new Array(256).fill(0);

    let sum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Luminance formula: Y = 0.299*R + 0.587*G + 0.114*B
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[luminance]++;
      sum += luminance;
    }

    const mean = sum / totalPixels;

    let varianceSum = 0;
    let skewnessSum = 0;
    let entropy = 0;

    for (let i = 0; i < 256; i++) {
      const count = histogram[i];
      if (count > 0) {
        const p = count / totalPixels;
        entropy -= p * Math.log2(p);
        
        const diff = i - mean;
        varianceSum += count * Math.pow(diff, 2);
        skewnessSum += count * Math.pow(diff, 3);
      }
    }

    const stdDev = Math.sqrt(varianceSum / totalPixels);
    const skewness = (skewnessSum / totalPixels) / Math.pow(stdDev, 3);
    const entropyRatio = (entropy / 8) * 100;

    setResults({
      histogram,
      entropy,
      mean,
      stdDev,
      skewness,
      entropyRatio,
      totalPixels
    });
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const url = e.target?.result as string;
      setImage(url);
      const img = new Image();
      img.onload = () => analyzeImage(img);
      img.src = url;
    };
    reader.readAsDataURL(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const getVerdict = () => {
    if (!results) return null;
    const { mean, stdDev, skewness, entropyRatio } = results;

    if (stdDev < 20) {
      return {
        title: "Baixa Faixa Dinâmica",
        description: "A imagem tem pouquíssima variação tonal. A maioria dos pixels está agrupada em torno de um único nível de brilho.",
        color: "text-amber-400",
        bg: "bg-amber-400/10",
        border: "border-amber-400/20",
        icon: <AlertCircle className="w-6 h-6" />
      };
    }

    if (mean < 85 || skewness > 1.5) {
      return {
        title: "Subexposta (Muito Escura)",
        description: "A imagem está fortemente inclinada para tons escuros. Detalhes nas sombras podem ser perdidos.",
        color: "text-blue-400",
        bg: "bg-blue-400/10",
        border: "border-blue-400/20",
        icon: <AlertCircle className="w-6 h-6" />
      };
    }

    if (mean > 170 || skewness < -1.5) {
      return {
        title: "Superexposta (Muito Clara)",
        description: "A imagem está fortemente inclinada para tons claros. Os realces podem estar 'estourados' ou cortados.",
        color: "text-orange-400",
        bg: "bg-orange-400/10",
        border: "border-orange-400/20",
        icon: <AlertCircle className="w-6 h-6" />
      };
    }

    if (entropyRatio > 75 && mean > 100 && mean < 155) {
      return {
        title: "Bem Equilibrada",
        description: "A imagem mostra uma distribuição saudável de tons com alto conteúdo de informação e boa exposição.",
        color: "text-emerald-400",
        bg: "bg-emerald-400/10",
        border: "border-emerald-400/20",
        icon: <CheckCircle2 className="w-6 h-6" />
      };
    }

    return {
      title: "Moderadamente Equilibrada",
      description: "A imagem tem uma exposição aceitável, mas poderia se beneficiar de uma melhor distribuição tonal.",
      color: "text-slate-400",
      bg: "bg-slate-400/10",
      border: "border-slate-400/20",
      icon: <Info className="w-6 h-6" />
    };
  };

  const verdict = getVerdict();

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-slate-200 font-sans selection:bg-blue-500/30 flex">
      {/* Sidebar */}
      <aside className="w-80 border-r border-slate-800 bg-[#0d0d10] hidden lg:flex flex-col sticky top-0 h-screen overflow-y-auto custom-scrollbar">
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
            <LayoutGrid className="w-4 h-4 text-blue-500" />
          </div>
          <h2 className="text-sm font-bold tracking-widest text-slate-400 uppercase">Ecossistema</h2>
        </div>

        <div className="p-6 space-y-4">
          <EcosystemCard 
            title="RANDOMNESS VALIDATOR"
            subtitle="Validador de Sequências Aleatórias"
            icon={<Shield className="w-4 h-4 text-blue-500" />}
            version="V-1.2"
            href="https://ai.studio/apps/90ad2f8a-9aac-4330-93e8-6fc4c43a591c"
            screenshot="/Imagem_Randomness.png"
          />
          <EcosystemCard 
            title="CYBERGUARD"
            subtitle="Análise de Entropia de Senhas"
            icon={<Shield className="w-4 h-4 text-emerald-500" />}
            version="V-1.2"
            href="https://ai.studio/apps/88411266-6994-4744-89a9-5cbd79e9df53"
            screenshot="/Imagem_Cyberguard.png"
          />
          <EcosystemCard 
            title="CYBERPASS"
            subtitle="Cofre e Gerador de Identidade"
            icon={<Lock className="w-4 h-4 text-blue-500" />}
            version="V-1.2"
            href="#"
            screenshot="/Imagem_Cyberpass.png"
          />
          <EcosystemCard 
            title="LUMINA ENTROPY"
            subtitle="Visualizador de Entropia Visual"
            icon={<Zap className="w-4 h-4 text-emerald-500" />}
            version="V-1.2"
            isActive
            href="#"
          />
        </div>

        <div className="mt-auto p-6 border-t border-slate-800">
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Auditor Ativo</span>
            </div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              Todas as aplicações no ecossistema são auditadas periodicamente para conformidade NIST.
            </p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto px-6 py-12">
        {/* Header */}
        <header className="mb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-medium mb-4"
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Teoria da Informação & Análise de Imagem
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4"
          >
            Lumina<span className="text-blue-500">Entropy</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-slate-400 max-w-2xl mx-auto text-lg mb-8"
          >
            Analise o equilíbrio de brilho e a integridade tonal de suas imagens usando a entropia de Shannon e métricas de distribuição estatística.
          </motion.p>

          {/* Tab Switcher */}
          <div className="flex justify-center gap-4 mb-8">
            <button
              onClick={() => setActiveTab('analyzer')}
              className={`px-6 py-2 rounded-xl border transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'analyzer'
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              Analisador
            </button>
            <button
              onClick={() => setActiveTab('guide')}
              className={`px-6 py-2 rounded-xl border transition-all duration-300 flex items-center gap-2 ${
                activeTab === 'guide'
                  ? 'bg-blue-500/20 border-blue-500 text-white'
                  : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
              }`}
            >
              <Info className="w-4 h-4" />
              Guia Visual
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'analyzer' ? (
            <motion.div
              key="analyzer"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8"
            >
              {/* Left Column: Upload and Image */}
              <div className="lg:col-span-5 space-y-6">
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`relative group rounded-2xl border-2 border-dashed transition-all duration-300 overflow-hidden ${
                    isDragging ? 'border-blue-500 bg-blue-500/5' : 'border-slate-800 hover:border-slate-700 bg-slate-900/30'
                  }`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                >
                  <input
                    type="file"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={handleFileUpload}
                    accept="image/*"
                  />
                  
                  <div className="p-8 text-center">
                    {image ? (
                      <div className="space-y-4">
                        <div className="relative aspect-square rounded-lg overflow-hidden bg-black/40 flex items-center justify-center">
                          <img src={image} alt="Uploaded" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                        </div>
                        <p className="text-sm text-slate-500">Clique ou arraste para substituir a imagem</p>
                      </div>
                    ) : (
                      <div className="py-12 space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-slate-800 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-300">
                          <Upload className="w-8 h-8 text-blue-500" />
                        </div>
                        <div>
                          <p className="text-lg font-medium text-white">Carregar uma imagem</p>
                          <p className="text-sm text-slate-500">Arraste e solte ou clique para navegar</p>
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Educational Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4"
                >
                  <div className="flex items-center gap-2 text-white font-semibold">
                    <InfoIcon className="w-5 h-5 text-blue-500" />
                    Entendendo a Ciência
                  </div>
                  <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
                    <p>
                      A <strong className="text-slate-200">Entropia de Shannon</strong> mede a "imprevisibilidade" ou densidade de informação de uma fonte de dados. Em imagens, quantifica quão diversos são os níveis de brilho dos pixels.
                    </p>
                    <p>
                      Um valor de <span className="text-blue-400">alta entropia</span> (próximo a 8 bits) sugere uma gama tonal rica e bem distribuída, onde os valores dos pixels são diversos e menos previsíveis.
                    </p>
                    <p>
                      A <span className="text-blue-400">baixa entropia</span> ocorre quando os pixels se agrupam (como em sombras pesadas ou realces estourados), tornando a imagem mais "previsível" e tonalmente comprimida.
                    </p>
                  </div>
                </motion.div>
              </div>

              {/* Right Column: Results */}
              <div className="lg:col-span-7 space-y-6">
                <AnimatePresence mode="wait">
                  {results ? (
                    <motion.div
                      key="results"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="space-y-6"
                    >
                      {/* Stats Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <StatCard label="Entropia" value={results.entropy.toFixed(2)} unit="bits" />
                        <StatCard label="Média" value={Math.round(results.mean).toString()} unit="/255" />
                        <StatCard label="Desvio Padrão" value={results.stdDev.toFixed(1)} unit="" />
                        <StatCard label="Assimetria" value={results.skewness.toFixed(2)} unit="" />
                      </div>

                      {/* Histogram Card */}
                      <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
                        <div className="flex items-center justify-between mb-6">
                          <h3 className="text-white font-semibold flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-500" />
                            Histograma de Luminância
                          </h3>
                          <div className="text-xs text-slate-500 font-mono">
                            0 (Escuro) → 255 (Claro)
                          </div>
                        </div>
                        <div className="relative h-56 w-full pl-12">
                          {/* Y Axis Label */}
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] text-blue-500/80 font-bold uppercase tracking-widest whitespace-nowrap origin-center -translate-x-4">
                            Quantidade de Pixels (Y)
                          </div>
                          
                          <div className="relative h-48 w-full bg-black/40 rounded-lg overflow-hidden p-2 border border-slate-800/80">
                            <Histogram data={results.histogram} />
                          </div>
                          
                          {/* X Axis Labels */}
                          <div className="mt-2 flex justify-between items-center px-2">
                            <div className="text-[10px] text-slate-500 font-bold">0 (Preto)</div>
                            <div className="text-[10px] text-blue-500/80 uppercase tracking-widest font-bold">Nível de Brilho (Eixo X)</div>
                            <div className="text-[10px] text-slate-500 font-bold">255 (Branco)</div>
                          </div>
                        </div>
                        <div className="mt-4 flex justify-between items-center">
                          <div className="text-xs text-slate-500">
                            Razão de Entropia: <span className="text-blue-400 font-medium">{results.entropyRatio.toFixed(1)}%</span>
                          </div>
                          <div className="text-xs text-slate-500">
                            Total de Pixels: <span className="text-slate-300 font-medium">{results.totalPixels.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Verdict Card */}
                      {verdict && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`${verdict.bg} ${verdict.border} border rounded-2xl p-6 flex gap-4 items-start`}
                        >
                          <div className={verdict.color}>{verdict.icon}</div>
                          <div>
                            <h3 className={`font-bold text-lg ${verdict.color} mb-1`}>{verdict.title}</h3>
                            <p className="text-slate-300 text-sm leading-relaxed">{verdict.description}</p>
                          </div>
                        </motion.div>
                      )}
                    </motion.div>
                  ) : (
                    <motion.div
                      key="placeholder"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-900/20 border border-slate-800/50 border-dashed rounded-3xl"
                    >
                      <div className="w-20 h-20 rounded-full bg-slate-800/50 flex items-center justify-center mb-6">
                        <ImageIcon className="w-10 h-10 text-slate-600" />
                      </div>
                      <h3 className="text-xl font-medium text-slate-400 mb-2">Nenhuma Análise Ainda</h3>
                      <p className="text-slate-500 max-w-xs">
                        Carregue uma imagem para ver sua distribuição tonal e análise de entropia.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="guide"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <VisualGuide />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <footer className="mt-20 pt-8 border-t border-slate-800 text-center text-slate-600 text-sm">
          <p>© 2026 LuminaEntropy • Construído com Princípios da Teoria da Informação</p>
        </footer>
      </main>
    </div>
  );
}

function EcosystemCard({ title, subtitle, icon, version, isActive, href, screenshot }: { title: string, subtitle: string, icon: React.ReactNode, version: string, isActive?: boolean, href: string, screenshot?: string }) {
  return (
    <a 
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
        isActive 
          ? 'bg-slate-900 border-slate-700 ring-1 ring-slate-700' 
          : 'bg-black/20 border-slate-800 hover:border-slate-700 hover:bg-slate-900/50'
      }`}
    >
      {isActive && (
        <div className="absolute top-4 right-4 w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
      )}
      
      <div className="aspect-video rounded-lg bg-black/40 mb-4 border border-slate-800/50 group-hover:border-slate-700 transition-colors relative flex items-center justify-center overflow-hidden">
        {screenshot ? (
          <img src={screenshot} alt={title} className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity" referrerPolicy="no-referrer" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent" />
        )}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {icon}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold tracking-tight text-white">{title}</span>
      </div>
      <p className="text-[10px] text-slate-500 italic mb-4">{subtitle}</p>
      
      <div className="flex items-center justify-between pt-4 border-t border-slate-800/50">
        <span className="text-[8px] font-bold text-slate-600 uppercase tracking-widest">Verificado {version}</span>
        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors">
          Acessar <ExternalLink className="w-2 h-2" />
        </div>
      </div>
    </a>
  );
}

function VisualGuide() {
  const [activeSceneId, setActiveSceneId] = useState('balanced');
  const imgCanvasRef = useRef<HTMLCanvasElement>(null);
  const histCanvasRef = useRef<HTMLCanvasElement>(null);

  const scenes = [
    {
      id: 'balanced',
      name: '✅ Bem Equilibrada',
      desc: 'Uma imagem bem exposta utiliza toda a gama de brilho. O histograma se espalha amplamente do escuro ao claro, sem picos extremos em nenhuma das extremidades. A entropia é alta porque os valores dos pixels são imprevisíveis — há uma rica variedade de tons.',
      histShape: 'balanced',
      entropyApprox: '7.4',
      meanApprox: '125',
      stdApprox: '58',
      color: '#4ade80',
      guide: 'Observe como as barras do histograma se espalham por toda a largura, desde o quase preto à esquerda até o quase branco à direita. Não há um único pico dominante — as barras são relativamente uniformes. Esse espalhamento é o que parece a "alta entropia": nenhum valor de brilho único domina, então os valores dos pixels são imprevisíveis e ricos em informação.'
    },
    {
      id: 'underexposed',
      name: '🌑 Subexposta',
      desc: 'Uma imagem muito escura tem a maioria dos pixels amontoados perto da esquerda (0 = preto). O histograma tem um pico alto no lado esquerdo e quase nada no direito. A entropia é baixa porque a maioria dos pixels é previsivelmente escura — pouca variedade de informação.',
      histShape: 'dark',
      entropyApprox: '5.8',
      meanApprox: '45',
      stdApprox: '25',
      color: '#8888ff',
      guide: 'Veja como o histograma está amontoado no lado esquerdo? Quase todas as barras estão na faixa de 0–80. O lado direito (tons claros) está quase vazio. Esta é a assinatura visual da subexposição. Se você escolhesse um pixel aleatório, poderia adivinhar com confiança que "é escuro" — é por isso que a entropia é baixa.'
    },
    {
      id: 'overexposed',
      name: '☀️ Superexposta',
      desc: 'Uma imagem muito clara tem a maioria dos pixels amontoados perto da direita (255 = branco). O histograma tem um pico alto no lado direito. Novamente, a entropia é baixa — os pixels são previsivelmente claros e os detalhes dos realces são perdidos (cortados para o branco).',
      histShape: 'bright',
      entropyApprox: '5.6',
      meanApprox: '210',
      stdApprox: '28',
      color: '#ffe04a',
      guide: 'O histograma está empilhado no lado direito, perto de 255. Há um pico alto onde os valores dos pixels estão "estourando" — atingindo o branco puro e perdendo detalhes. O lado esquerdo (sombras) está quase vazio. Este é o reflexo da subexposição, e a entropia é baixa pelo mesmo motivo: os valores dos pixels são previsivelmente claros.'
    },
    {
      id: 'lowcontrast',
      name: '🌫 Baixo Contraste',
      desc: 'Uma imagem plana e com aparência de névoa, onde todos os pixels estão agrupados em uma faixa estreita em torno do cinza médio. O histograma é um pico estreito no meio. A entropia é moderada, mas o desvio padrão é muito baixo — a imagem parece lavada.',
      histShape: 'lowcontrast',
      entropyApprox: '6.2',
      meanApprox: '128',
      stdApprox: '18',
      color: '#ff8080',
      guide: 'O histograma é um pico estreito no meio. Todos os pixels estão amontoados em uma pequena faixa em torno de 110–140. Não há pretos profundos nem brancos brilhantes. É assim que parece a "baixa faixa dinâmica" ou imagem "plana". O desvio padrão é minúsculo. Mesmo que a média esteja centralizada, a imagem parece lavada porque não há variedade tonal.'
    },
    {
      id: 'highcontrast',
      name: '⬛⬜ Alto Contraste',
      desc: 'Uma imagem com escuros extremos e claros extremos, mas sem muito entre eles. O histograma tem dois picos (bimodal) em extremidades opostas. A entropia pode ser moderada, mas o formato da distribuição nos diz que os tons médios estão ausentes.',
      histShape: 'highcontrast',
      entropyApprox: '6.5',
      meanApprox: '127',
      stdApprox: '95',
      color: '#ccc',
      guide: 'O histograma tem dois picos separados — um perto da extremidade escura e outro perto da extremidade clara, com um vale no meio. Esse formato "bimodal" significa que a imagem é composta por sombras severas e realces estourados, com poucos tons médios. O desvio padrão é muito alto, mas a ausência de tons médios pode tornar a imagem dura e artificial.'
    }
  ];

  const activeScene = scenes.find(s => s.id === activeSceneId)!;

  useEffect(() => {
    if (!imgCanvasRef.current || !histCanvasRef.current) return;

    const imgCanvas = imgCanvasRef.current;
    const imgCtx = imgCanvas.getContext('2d')!;
    const w = imgCanvas.width;
    const h = imgCanvas.height;

    const imgData = imgCtx.createImageData(w, h);
    const d = imgData.data;
    const type = activeScene.histShape;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        let v = 0;
        const nx = x / w, ny = y / h;

        if (type === 'balanced') {
          const base = nx * 200 + ny * 55;
          const noise = (Math.random() - 0.5) * 80;
          const cx1 = 0.3, cy1 = 0.4, cx2 = 0.7, cy2 = 0.6;
          const d1 = Math.sqrt((nx-cx1)**2 + (ny-cy1)**2);
          const d2 = Math.sqrt((nx-cx2)**2 + (ny-cy2)**2);
          const circle1 = d1 < 0.25 ? (1 - d1/0.25) * 120 : 0;
          const circle2 = d2 < 0.2 ? (1 - d2/0.2) * (-80) : 0;
          v = base + noise + circle1 + circle2;
        } else if (type === 'dark') {
          const base = nx * 60 + ny * 30;
          const noise = (Math.random() - 0.5) * 40;
          const d1 = Math.sqrt((nx-0.5)**2 + (ny-0.5)**2);
          const spot = d1 < 0.15 ? (1-d1/0.15)*80 : 0;
          v = base + noise + spot;
        } else if (type === 'bright') {
          const base = 170 + nx * 60 + ny * 25;
          const noise = (Math.random() - 0.5) * 40;
          const d1 = Math.sqrt((nx-0.4)**2 + (ny-0.5)**2);
          const spot = d1 < 0.2 ? -(1-d1/0.2)*70 : 0;
          v = base + noise + spot;
        } else if (type === 'lowcontrast') {
          const base = 110 + nx * 30 + ny * 15;
          const noise = (Math.random() - 0.5) * 20;
          v = base + noise;
        } else if (type === 'highcontrast') {
          const base = nx * 255;
          const thresh = 0.5 + Math.sin(ny * 8) * 0.15;
          const sharp = nx < thresh ? 30 : 225;
          const noise = (Math.random() - 0.5) * 50;
          v = sharp + noise;
        }

        v = Math.max(0, Math.min(255, Math.round(v)));
        let r = v, g = v, b = v;
        if (type === 'balanced') { r = Math.min(255, v + 5); g = Math.min(255, v + 2); b = v; }
        else if (type === 'dark') { r = v; g = v; b = Math.min(255, v + 15); }
        else if (type === 'bright') { r = Math.min(255, v + 8); g = Math.min(255, v + 5); b = v; }

        d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = 255;
      }
    }
    imgCtx.putImageData(imgData, 0, 0);

    const hist = new Array(256).fill(0);
    for (let i = 0; i < d.length; i += 4) {
      const lum = Math.round(0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]);
      hist[Math.max(0,Math.min(255,lum))]++;
    }

    const histCanvas = histCanvasRef.current;
    const hCtx = histCanvas.getContext('2d')!;
    const hW = histCanvas.width;
    const hH = histCanvas.height;
    hCtx.clearRect(0, 0, hW, hH);

    let maxVal = Math.max(...hist);
    const pad = 2;
    const barW = (hW - pad * 2) / 256;

    hist.forEach((count, i) => {
      const barH = (count / maxVal) * (hH - 12);
      const x = pad + i * barW;
      const t = i / 255;
      const r = Math.round(30 + t * 180);
      const g = Math.round(30 + t * 180);
      const b = Math.round(50 + t * 180);
      hCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      hCtx.fillRect(x, hH - 6 - barH, Math.max(barW - 0.2, 0.5), barH);
    });

    hCtx.strokeStyle = activeScene.color;
    hCtx.lineWidth = 1.5;
    hCtx.globalAlpha = 0.4;
    hCtx.beginPath();
    hist.forEach((count, i) => {
      const barH = (count / maxVal) * (hH - 12);
      const x = pad + i * barW + barW / 2;
      if (i === 0) hCtx.moveTo(x, hH - 6 - barH);
      else hCtx.lineTo(x, hH - 6 - barH);
    });
    hCtx.stroke();
    hCtx.globalAlpha = 1;

  }, [activeSceneId]);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Como é um Histograma de Brilho</h2>
        <p className="text-slate-400">Clique em cada cenário para ver como a imagem e o histograma mudam</p>
      </div>

      <div className="flex flex-wrap justify-center gap-3">
        {scenes.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSceneId(s.id)}
            className={`px-4 py-2 rounded-xl border transition-all duration-300 text-sm ${
              activeSceneId === s.id
                ? 'bg-blue-500/20 border-blue-500 text-white'
                : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h3 className="text-xl font-bold mb-2" style={{ color: activeScene.color }}>{activeScene.name}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{activeScene.desc}</p>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h4 className="text-white font-semibold text-sm">Imagem Simulada</h4>
              <div className="aspect-video bg-black/40 rounded-lg overflow-hidden border border-slate-800">
                <canvas ref={imgCanvasRef} width={400} height={260} className="w-full h-full object-cover" />
              </div>
              <p className="text-[10px] text-slate-600 text-center">Exemplo gerado proceduralmente</p>
            </div>
            <div className="space-y-4">
              <h4 className="text-white font-semibold text-sm">Seu Histograma de Brilho</h4>
              <div className="relative pl-8">
                {/* Y Axis Label */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -rotate-90 text-[8px] text-slate-600 font-bold uppercase tracking-widest whitespace-nowrap">
                  Qtd. de Pixels (Eixo Y)
                </div>
                
                <div className="h-48 bg-black/40 rounded-lg overflow-hidden border border-slate-800 p-2">
                  <canvas ref={histCanvasRef} width={400} height={200} className="w-full h-full" />
                </div>
                
                <div className="flex justify-between text-[10px] text-slate-600 px-1 mt-2">
                  <span>0 (Preto)</span>
                  <span className="uppercase tracking-widest text-slate-700 font-bold text-[8px]">Nível de Brilho (Eixo X)</span>
                  <span>255 (Branco)</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8">
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Entropia</div>
              <div className="text-sm font-bold" style={{ color: activeScene.color }}>~{activeScene.entropyApprox} bits</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Média</div>
              <div className="text-sm font-bold" style={{ color: activeScene.color }}>~{activeScene.meanApprox}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Desvio Padrão</div>
              <div className="text-sm font-bold" style={{ color: activeScene.color }}>~{activeScene.stdApprox}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 text-center">
              <div className="text-[9px] uppercase tracking-wider text-slate-500 font-bold mb-1">Razão Entropia</div>
              <div className="text-sm font-bold" style={{ color: activeScene.color }}>~{(parseFloat(activeScene.entropyApprox)/8*100).toFixed(0)}%</div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6">
          <h4 className="text-white font-bold mb-4 flex items-center gap-2">
            <InfoIcon className="w-5 h-5 text-blue-500" />
            Como ler isso
          </h4>
          <p className="text-slate-300 text-sm leading-relaxed">{activeScene.guide}</p>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-1">{label}</div>
      <div className="text-2xl font-bold text-white leading-none mb-1">
        {value}
        {unit && <span className="text-xs font-normal text-slate-500 ml-1">{unit}</span>}
      </div>
    </div>
  );
}

function Histogram({ data }: { data: number[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const maxCount = Math.max(...data);

    ctx.clearRect(0, 0, width, height);

    data.forEach((count, i) => {
      const barHeight = (count / maxCount) * height;
      const x = (i / 256) * width;
      const barWidth = width / 256;

      // Gradient from dark to light
      const hue = 210; // Blueish
      const saturation = 70;
      const lightness = 20 + (i / 255) * 60;
      ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      
      ctx.fillRect(x, height - barHeight, barWidth + 1, barHeight);
    });
  }, [data]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="w-full h-full"
    />
  );
}
