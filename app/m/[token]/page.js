'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dataLonga } from '@/lib/util';

// Tela do músico, aberta pelo link pessoal: as próximas missas em que está escalado.
// O link fica guardado no aparelho, e a lista também (para abrir sem internet).
export default function TelaMusico() {
  const { token } = useParams();
  const [d, setD] = useState(undefined);
  const [erro, setErro] = useState('');

  useEffect(() => {
    try { localStorage.setItem('missa:token', token); } catch {}
    let local = null;
    try { local = JSON.parse(localStorage.getItem('missa:painel:' + token) || 'null'); } catch {}
    if (local) setD(local);
    (async () => {
      const { data, error } = await supabase.rpc('missa_painel_musico', { p_token: token });
      if (error) { if (!local) setErro(navigator.onLine ? 'Não foi possível abrir agora.' : 'Sem internet e esta tela ainda não foi aberta neste aparelho.'); return; }
      if (!data) { try { localStorage.removeItem('missa:token'); localStorage.removeItem('missa:painel:' + token); } catch {} setD(null); setErro('Link inválido ou desativado. Peça um novo link ao administrador.'); return; }
      setD(data);
      try { localStorage.setItem('missa:painel:' + token, JSON.stringify(data)); } catch {}
    })();
  }, [token]);

  if (d === undefined && !erro) return <div className="wrap mut">Carregando…</div>;
  if (!d) return <div className="wrap"><div className="card" style={{ marginTop: 24 }}><h2>Não foi possível abrir</h2><p className="err">{erro}</p></div></div>;
  return (
    <div className="wrap">
      <h1>Olá, {d.nome.split(' ')[0]}!</h1>
      <p className="mut">Suas próximas missas. Abra uma e toque em “Baixar para usar sem internet” antes de sair de casa.</p>
      {d.missas.length === 0 && <div className="card mut">Nenhuma missa marcada para você no momento.</div>}
      {d.missas.map(m => (
        <a key={m.id} href={'/missa/' + m.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card">
            <strong>{dataLonga(m.data_hora)}</strong>
            <div className="mut">{[m.titulo, m.local].filter(Boolean).join(' · ') || 'Missa'}{m.instrumento ? ' · ' + m.instrumento : ''}</div>
            <div style={{ marginTop: 8, color: 'var(--ouro-escuro)' }}>🎼 Abrir modo celebração ▸</div>
          </div>
        </a>
      ))}
    </div>
  );
}
