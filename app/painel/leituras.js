'use client';
import { useEffect, useState } from 'react';
import { buscarLiturgia } from '@/lib/util';

// Leituras do dia (Liturgia Diária · CNBB) em seções que abrem e fecham,
// para ajudar a escolher as músicas. Recebe as leituras prontas ou a data para consultar.
export default function LeiturasDoDia({ leituras: prontas, data }) {
  const [leituras, setLeituras] = useState(prontas || null);
  const [estado, setEstado] = useState(prontas ? 'ok' : 'carregando');

  useEffect(() => {
    if (prontas) { setLeituras(prontas); setEstado('ok'); return; }
    if (!data) return;
    let vivo = true; setEstado('carregando');
    buscarLiturgia(data, true).then(l => {
      if (!vivo) return;
      if (l?.leituras?.length) { setLeituras(l.leituras); setEstado('ok'); } else setEstado('erro');
    });
    return () => { vivo = false; };
  }, [prontas, data]);

  if (estado === 'carregando') return <p className="mut">Consultando as leituras do dia…</p>;
  if (estado === 'erro' || !leituras?.length) return <p className="mut">Não foi possível consultar as leituras deste dia.</p>;
  return (
    <div className="leituras">
      {leituras.map(l => (
        <details key={l.tipo} className="leitura">
          <summary>
            <span className="leitura-tit">{l.titulo}</span> <span className="mut">{l.sigla || l.referencia}</span>
            {l.resumo && <span className="leitura-res">{l.resumo}</span>}
          </summary>
          <p style={{ margin: '8px 0 6px', fontWeight: 600 }}>{l.abertura} <span className="mut">{l.referencia}</span></p>
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{l.texto}</div>
        </details>
      ))}
      <p className="mut" style={{ fontSize: '.8rem', margin: '4px 0 0' }}>Fonte: <a href="https://liturgiadiaria.edicoescnbb.com.br/" target="_blank" rel="noreferrer">Liturgia Diária · Edições CNBB</a></p>
    </div>
  );
}
