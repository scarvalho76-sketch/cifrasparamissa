'use client';
import { useEffect, useState } from 'react';
import { buscarLiturgia } from '@/lib/util';

// Leituras do dia (Liturgia Diária · CNBB) em seções que abrem e fecham, na ordem da missa:
// Primeira leitura, Salmo responsorial, Segunda leitura e Evangelho (como no Modo celebração).
// Recebe as leituras prontas ou a data para consultar; onCarregou avisa quem precisar do salmo.
export default function LeiturasDoDia({ leituras: prontas, salmo: salmoPronto, data, onCarregou }) {
  const [leituras, setLeituras] = useState(prontas || null);
  const [salmo, setSalmo] = useState(salmoPronto || null);
  const [estado, setEstado] = useState(prontas ? 'ok' : 'carregando');

  useEffect(() => {
    if (prontas) { setLeituras(prontas); setSalmo(salmoPronto || null); setEstado('ok'); return; }
    if (!data) return;
    let vivo = true; setEstado('carregando');
    buscarLiturgia(data, true).then(l => {
      if (!vivo) return;
      onCarregou?.(l);
      if (l?.leituras?.length || l?.salmo) { setLeituras(l.leituras || []); setSalmo(l.salmo || null); setEstado('ok'); } else setEstado('erro');
    });
    return () => { vivo = false; };
  }, [prontas, salmoPronto, data]);

  if (estado === 'carregando') return <p className="mut">Consultando as leituras do dia…</p>;
  if (estado === 'erro' || (!leituras?.length && !salmo)) return <p className="mut">Não foi possível consultar as leituras deste dia.</p>;
  // o salmo entra logo depois da Primeira leitura
  const lista = [...(leituras || [])];
  if (salmo) {
    const s = { tipo: 'salmo', titulo: 'Salmo responsorial', sigla: salmo.referencia, resumo: salmo.refrao ? 'R. ' + salmo.refrao : '', texto: (salmo.refrao ? 'R. ' + salmo.refrao + '\n\n' : '') + (salmo.texto || '') };
    const i = lista.findIndex(l => l.tipo === 'primeira');
    lista.splice(i + 1, 0, s);
  }
  return (
    <div className="leituras">
      {lista.map(l => (
        <details key={l.tipo} className="leitura">
          <summary>
            <span className="leitura-tit">{l.titulo}</span> <span className="mut">{l.sigla || l.referencia}</span>
            {l.resumo && <span className="leitura-res">{l.resumo}</span>}
          </summary>
          {l.tipo !== 'salmo' && <p style={{ margin: '8px 0 6px', fontWeight: 600 }}>{l.abertura} <span className="mut">{l.referencia}</span></p>}
          <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.55, marginTop: l.tipo === 'salmo' ? 8 : 0 }}>{l.texto}</div>
        </details>
      ))}
      <p className="mut" style={{ fontSize: '.8rem', margin: '4px 0 0' }}>Fonte: <a href="https://liturgiadiaria.edicoescnbb.com.br/" target="_blank" rel="noreferrer">Liturgia Diária · Edições CNBB</a></p>
    </div>
  );
}
