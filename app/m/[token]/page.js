'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dataLonga, lerPref, gravarPref } from '@/lib/util';
import CalendarioMusico from '@/components/CalendarioMusico';

// Missas baixadas para uso sem internet neste aparelho (marca "missa:<id>:pagina" = 1)
function lerGuardadas() {
  const lista = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith('missa:') || !k.endsWith(':pagina') || localStorage.getItem(k) !== '1') continue;
      const id = k.slice(6, -7);
      const copia = JSON.parse(localStorage.getItem('missa:' + id) || 'null');
      if (copia && copia.data_hora) lista.push({ id, data_hora: copia.data_hora, titulo: copia.titulo });
    }
  } catch {}
  return lista.sort((a, b) => String(a.data_hora).localeCompare(String(b.data_hora)));
}

function GuardadasNeste({ lista }) {
  if (!lista.length) return null;
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <strong>📴 Guardadas neste aparelho</strong>
      <p className="mut" style={{ margin: '4px 0 6px', fontSize: '.85rem' }}>Estas missas abrem mesmo sem internet.</p>
      {lista.map(m => (
        <a key={m.id} href={'/missa/' + m.id} style={{ display: 'block', padding: '6px 0', color: 'inherit', textDecoration: 'none' }}>
          {dataLonga(m.data_hora)} · {m.titulo || 'Missa'} ▸
        </a>
      ))}
    </div>
  );
}

// Tela do músico, aberta pelo link pessoal, em abas (como no Sonata):
// Calendário (missas do mês) e Escalas (as próximas missas em que está escalado).
// O link fica guardado no aparelho, e a lista também (para abrir sem internet).
export default function TelaMusico() {
  const { token } = useParams();
  const [d, setD] = useState(undefined);
  const [erro, setErro] = useState('');
  const [aba, setAba] = useState('cal');
  useEffect(() => { const a = lerPref('missa:musico:aba', 'cal'); if (['cal', 'esc'].includes(a)) setAba(a); }, []);
  const [guardadas, setGuardadas] = useState([]);
  useEffect(() => { setGuardadas(lerGuardadas()); }, []);
  const trocarAba = a => { setAba(a); gravarPref('missa:musico:aba', a); window.scrollTo({ top: 0 }); };

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

  // Sair: apaga deste aparelho o link pessoal, a lista e as missas guardadas
  async function sair() {
    if (!confirm('Sair deste aparelho? Para entrar de novo, abra o seu link pessoal.')) return;
    try {
      Object.keys(localStorage).filter(k => k.startsWith('missa:') && !['missa:fonte', 'missa:formato', 'missa:capo'].includes(k))
        .forEach(k => localStorage.removeItem(k));
    } catch {}
    try { if ('caches' in window) await caches.delete('missa-celebracao-v1'); } catch {}
    location.replace('/saiu');
  }

  if (d === undefined && !erro) return <div className="wrap"><GuardadasNeste lista={guardadas} /><div className="mut">Carregando…</div></div>;
  if (!d) return <div className="wrap"><GuardadasNeste lista={guardadas} /><div className="card" style={{ marginTop: 24 }}><h2>Não foi possível abrir</h2><p className="err">{erro}</p></div></div>;
  return (
    <div className="wrap">
      <div className="row">
        <h1>Olá, {d.nome.split(' ')[0]}!</h1>
        <button className="sec mini" onClick={sair}>Sair</button>
      </div>
      <GuardadasNeste lista={guardadas} />
      <div className="tabs">
        <button className={aba === 'cal' ? 'on' : ''} onClick={() => trocarAba('cal')}>Calendário</button>
        <button className={aba === 'esc' ? 'on' : ''} onClick={() => trocarAba('esc')}>Escalas{d.missas.length ? ` (${d.missas.length})` : ''}</button>
      </div>
      {aba === 'cal' && <CalendarioMusico missas={[...(d.passadas || []), ...d.missas]} />}
      {aba === 'esc' && <>
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
      </>}
    </div>
  );
}
