'use client';
import { useState } from 'react';
import { simples } from '@/lib/util';

// Busca na Biblioteca por nome, cantor ou momento; cada resultado tem um botão para acrescentar
export default function BuscaMusicas({ musicas, momentos = [], onEscolher, jaTem = new Set(), autoFocus = false }) {
  const [busca, setBusca] = useState('');
  const [mom, setMom] = useState('');
  const t = simples(busca);
  const achadas = (t || mom) ? (musicas || []).filter(m =>
    (!mom || m.momentos.includes(mom)) &&
    (!t || simples(m.nome + ' ' + m.artista + ' ' + m.momentos.join(' ')).includes(t))
  ).slice(0, 30) : [];
  return (
    <div className="busca-musicas">
      <div className="row" style={{ alignItems: 'flex-start', gap: 6 }}>
        <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Nome, cantor ou momento" autoComplete="off" autoFocus={autoFocus} style={{ flex: '1 1 180px', margin: 0 }} />
        <select value={mom} onChange={e => setMom(e.target.value)} style={{ flex: '0 1 170px', margin: 0 }} aria-label="Filtrar por momento">
          <option value="">Qualquer momento</option>
          {momentos.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
      {(t || mom) && achadas.length === 0 && <p className="mut" style={{ margin: '8px 0 0' }}>Nenhuma música encontrada.</p>}
      {achadas.length > 0 && (
        <ul className="busca-lista">
          {achadas.map(m => (
            <li key={m.id}>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{m.nome}</strong>{m.artista ? <span className="mut"> · {m.artista}</span> : null}
                {m.momentos.length > 0 && <span className="busca-mom">{m.momentos.join(' · ')}</span>}
              </span>
              <button type="button" className={'mini' + (jaTem.has(m.id) ? ' sec' : '')} onClick={() => onEscolher(m)}>{jaTem.has(m.id) ? '+ de novo' : '+ Adicionar'}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
