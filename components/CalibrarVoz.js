'use client';
import { useEffect, useState } from 'react';
import { calibrar, lerCalibracao, nivel } from '@/lib/voz';

// Botão do topo: calibra o microfone no ambiente (silêncio x voz) para a rolagem por voz
export default function CalibrarVoz() {
  const [cal, setCal] = useState(null);
  const [etapa, setEtapa] = useState('');
  const [n, setN] = useState(0);
  useEffect(() => { setCal(lerCalibracao()); }, []);
  useEffect(() => {
    if (!etapa || etapa === 'fim') return;
    let q; const loop = () => { setN(nivel()); q = requestAnimationFrame(loop); }; loop();
    return () => cancelAnimationFrame(q);
  }, [etapa]);
  async function iniciar() {
    try { const c = await calibrar(setEtapa); setCal(c); setEtapa('fim'); }
    catch (e) { setEtapa('erro:' + (e.message || 'microfone indisponível')); }
  }
  const texto = { silencio: '1/2 · Fique em silêncio (barulho do ambiente)…', cante: '2/2 · Agora cante um trecho, no volume normal…' }[etapa];
  return (
    <div className="voz-calibrar">
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8 }}>
        <button type="button" className="sec cer-mini" onClick={iniciar} disabled={etapa === 'silencio' || etapa === 'cante'}>🎤 Calibrar voz</button>
        <span className="mut" style={{ fontSize: '.85rem' }}>
          {texto || (etapa.startsWith('erro:') ? <span className="err">Não foi possível usar o microfone: {etapa.slice(5)}</span>
            : cal ? (cal.voz - cal.fundo < 8 ? '⚠ Calibrado, mas com pouca diferença entre ambiente e voz' : '✓ Voz calibrada neste aparelho') : 'Para a rolagem por voz (🎤 na barra de cada música)')}
        </span>
      </div>
      {texto && <div className="voz-medidor"><div style={{ width: n + '%' }} /></div>}
    </div>
  );
}
