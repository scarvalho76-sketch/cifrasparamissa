'use client';
import { useEffect, useState } from 'react';
import { lerPref, gravarPref } from '@/lib/util';
import Musicos from './musicos';
import Momentos from './momentos';
import Oracoes from './oracoes';
import Amigos from './amigos';

// Configurações (só o administrador): Músicos, Momentos, Orações e Amigos num só lugar
const SECOES = [['musicos', '🎸 Músicos'], ['momentos', '🔢 Momentos'], ['oracoes', '✝ Orações'], ['amigos', '👥 Amigos']];

export default function Configuracoes() {
  const [secao, setSecao] = useState('musicos');
  useEffect(() => { const s = lerPref('painel:config', 'musicos'); setSecao(SECOES.some(([k]) => k === s) ? s : 'musicos'); }, []);
  const trocar = k => { setSecao(k); gravarPref('painel:config', k); };
  return (
    <>
      <div className="config-secoes" role="tablist" aria-label="Configurações">
        {SECOES.map(([k, t]) => (
          <button key={k} type="button" role="tab" aria-selected={secao === k} className={'chip' + (secao === k ? ' on' : '')} onClick={() => trocar(k)}>{t}</button>
        ))}
      </div>
      {secao === 'musicos' && <Musicos />}
      {secao === 'momentos' && <Momentos />}
      {secao === 'oracoes' && <Oracoes />}
      {secao === 'amigos' && <Amigos />}
    </>
  );
}
