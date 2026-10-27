'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dataLonga, lerPref, gravarPref } from '@/lib/util';
import { transporCifra, distancia, nomeDoTom, gerarGrade, letraDaCifra } from '@/lib/musica';
import { carregarBiblioteca } from '@/lib/biblioteca';
import Rolagem from '@/components/Rolagem';
import BuscaMusicas from '@/components/BuscaMusicas';
import { destacarPartes } from '@/components/Destaque';
import ConviteBotao from '@/components/ConviteBotao';

// Modo evento: a playlist do evento, música a música, com "Já toquei", troca de ordem
// e músicas novas no fim. Fica guardado no aparelho para abrir sem internet.
const CACHE = 'missa-celebracao-v1';
const chave = id => 'evento:' + id;
const ler = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
const gravar = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const meioTom = n => (n > 0 ? '+' : '') + (n / 2).toLocaleString('pt-BR') + ' tom';
const CAMPOS = 'nome, artista, cifra, letra, grade, tom_original, tom_padrao, capo';

async function guardarPagina() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('Este navegador não permite guardar a página para uso sem internet.');
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const arquivos = performance.getEntriesByType('resource').map(r => r.name)
    .filter(u => u.startsWith(location.origin) && new URL(u).pathname.startsWith('/_next/static/'));
  const cache = await caches.open(CACHE);
  await cache.addAll([...new Set([location.pathname, '/emblema.webp', ...arquivos])]);
}

export default function ModoEvento() {
  const { id } = useParams();
  const [d, setD] = useState(undefined);   // { evento, itens }
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');
  const [aberto, setAberto] = useState(null);
  const [online, setOnline] = useState(true);
  const [fonte, setFonte] = useState(1);
  const [formato, setFormato] = useState('cifra');
  const [usaCapo, setUsaCapo] = useState(true);
  const [ajustes, setAjustes] = useState({});
  const [biblio, setBiblio] = useState(null);
  const [adicionando, setAdicionando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const refs = useRef({});
  const abertoRef = useRef(null); abertoRef.current = aberto;
  const [convite, setConvite] = useState(null); // convidado: só leitura

  async function carregar(cv = convite) {
    if (cv) { // convidado: dados pela função do banco, só leitura
      const { data, error } = await supabase.rpc('evento_dados', { p_id: id, p_convite: cv });
      if (error) throw error;
      const novo = { ...data, convidado: true, salvo_em: new Date().toISOString() };
      setD(novo); gravar(chave(id), novo); return novo;
    }
    const [a, b] = await Promise.all([
      supabase.from('missa_eventos').select('*').eq('id', id).single(),
      supabase.from('missa_evento_musicas').select(`id, ordem, tocada, tom, capo, musica_id, missa_musicas(${CAMPOS})`).eq('evento_id', id).order('ordem')
    ]);
    if (a.error) throw a.error;
    const novo = { evento: a.data, itens: (b.data || []).map(x => ({ ...x, m: x.missa_musicas || null })), salvo_em: new Date().toISOString() };
    setD(novo); gravar(chave(id), novo); return novo;
  }

  useEffect(() => {
    setFonte(lerPref('missa:fonte', 1)); setFormato(lerPref('missa:formato', 'cifra') || 'cifra');
    setUsaCapo(lerPref('missa:capo', true) ?? true); setAjustes(lerPref(chave(id) + ':ajustes', {}));
    let cv = new URLSearchParams(location.search).get('c');
    try { if (cv) localStorage.setItem('evento:convite:' + id, cv); else cv = localStorage.getItem('evento:convite:' + id); } catch {}
    setConvite(cv);
    let local = ler(chave(id));
    // convidado depois do dia do evento: apaga a cópia guardada
    const dia = s => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));
    if (cv && local?.convidado && dia(Date.now()) > dia(local.evento.data_hora)) {
      try { [chave(id), chave(id) + ':pagina', chave(id) + ':ajustes', 'evento:convite:' + id].forEach(k => localStorage.removeItem(k)); } catch {}
      local = null; setErro('Este link de convidado venceu: ele valia até o dia do evento. A cópia guardada neste aparelho foi apagada.'); setD(null); return;
    }
    if (local) setD(local);
    const b = ler('evento:biblioteca'); if (b) setBiblio(b);
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    carregar(cv).catch(e => { if (!local) setErro(navigator.onLine ? (cv ? (e.message || 'Link inválido.') : 'Não foi possível abrir este evento (entre no painel com o seu acesso).') : 'Sem internet e este evento ainda não foi guardado neste aparelho.'); });
    if (!cv) carregarBiblioteca().then(x => { setBiblio(x); gravar('evento:biblioteca', x); }).catch(() => {});
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [id]);

  // tela sempre acesa
  useEffect(() => {
    let trava = null; let ativo = true;
    const pedir = async () => { try { if (ativo && document.visibilityState === 'visible' && 'wakeLock' in navigator) trava = await navigator.wakeLock.request('screen'); } catch {} };
    pedir(); const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { ativo = false; document.removeEventListener('visibilitychange', vis); try { trava?.release(); } catch {} };
  }, []);

  // pedal / teclado: ← rolagem · → próxima · ↑ ↓ mover o texto
  useEffect(() => {
    const tecla = e => {
      const alvo = e.target;
      if (e.altKey || e.ctrlKey || e.metaKey || (alvo && (alvo.tagName === 'INPUT' || alvo.tagName === 'TEXTAREA' || alvo.tagName === 'SELECT' || alvo.isContentEditable))) return;
      const passo = Math.round(window.innerHeight * 0.3);
      if (e.key === 'ArrowLeft') { e.preventDefault(); if (abertoRef.current !== null) window.dispatchEvent(new Event('cantus:rolagem')); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); const p = document.querySelector('.cer-ativo [id^="fim-"] .cer-prox'); if (p) p.click(); else if (abertoRef.current === null) document.querySelector('.cer-mom .cer-cab')?.click(); }
      else if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); window.scrollBy({ top: passo, behavior: 'smooth' }); }
      else if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); window.scrollBy({ top: -passo, behavior: 'smooth' }); }
    };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, []);

  function abrir(n) {
    const novo = aberto === n ? null : n; setAberto(novo);
    if (novo !== null) setTimeout(() => refs.current[novo]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }
  const falhou = e => setMsg(navigator.onLine ? 'Não foi possível salvar: ' + (e?.message || 'tente de novo.') : 'Sem internet: esta alteração precisa de conexão.');

  async function marcarTocada(it, v) {
    setD(x => ({ ...x, itens: x.itens.map(i => i.id === it.id ? { ...i, tocada: v } : i) }));
    const { error } = await supabase.from('missa_evento_musicas').update({ tocada: v }).eq('id', it.id);
    if (error) { falhou(error); carregar().catch(() => {}); } else setMsg('');
  }
  async function mover(n, dlt) {
    const nova = [...d.itens]; [nova[n], nova[n + dlt]] = [nova[n + dlt], nova[n]];
    setD(x => ({ ...x, itens: nova }));
    if (aberto === n) setAberto(n + dlt); else if (aberto === n + dlt) setAberto(n);
    const res = await Promise.all(nova.map((x, i) => x.ordem === (i + 1) * 10 ? { error: null } : supabase.from('missa_evento_musicas').update({ ordem: (i + 1) * 10 }).eq('id', x.id)));
    const erroUm = res.find(r => r.error)?.error;
    if (erroUm) falhou(erroUm); else setMsg('');
    carregar().catch(() => {});
  }
  async function adicionar(m) {
    const ordem = (d.itens[d.itens.length - 1]?.ordem || 0) + 10;
    const { error } = await supabase.from('missa_evento_musicas').insert({ evento_id: id, musica_id: m.id, ordem });
    if (error) return falhou(error);
    setMsg(''); setAdicionando(false);
    const novo = await carregar().catch(() => null);
    if (novo) { const n = novo.itens.length - 1; setAberto(n); setTimeout(() => refs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80); }
  }
  async function baixar() {
    setBaixando(true); setMsg('');
    try { await carregar(); await guardarPagina(); gravar(chave(id) + ':pagina', 1); setMsg('Pronto: este evento abre neste aparelho mesmo sem internet.'); }
    catch (e) { setMsg('Não foi possível guardar agora: ' + (e.message || 'tente de novo com internet.')); }
    setBaixando(false);
  }
  const mudarFonte = dlt => { const v = Math.min(2, Math.max(0.7, Math.round((fonte + dlt) * 10) / 10)); setFonte(v); gravarPref('missa:fonte', v); };
  const mudarFormato = v => { setFormato(v); gravarPref('missa:formato', v); };
  const ajustar = (k, dlt) => { const novo = { ...ajustes, [k]: dlt === null ? 0 : (ajustes[k] || 0) + dlt }; setAjustes(novo); gravarPref(chave(id) + ':ajustes', novo); };
  function sair() {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = '/painel';
  }

  if (d === undefined && !erro) return <div className="wrap">Carregando…</div>;
  if (!d) return <div className="wrap"><div className="card" style={{ marginTop: 24 }}><h1>Modo evento</h1><p className="err">{erro}</p></div></div>;
  const ev = d.evento; const itens = d.itens;
  const mostraCifra = formato !== 'letra';
  const algumCapo = mostraCifra && itens.some(i => (i.capo ?? i.m?.capo) > 0);
  const tocadas = itens.filter(i => i.tocada).length;
  const dono = !d.convidado;

  return (
    <div className="wrap cer">
      <div className="card">
        <div className="mut">{dataLonga(ev.data_hora)}</div>
        <h1 style={{ marginTop: 4 }}>{ev.nome || ev.tipo || 'Evento'}</h1>
        <div className="mut">{[ev.tipo, ev.local].filter(Boolean).join(' · ')} · {itens.length} {itens.length === 1 ? 'música' : 'músicas'}{tocadas ? ` · ${tocadas} já tocada${tocadas > 1 ? 's' : ''}` : ''}</div>
        {ev.obs && <p style={{ margin: '6px 0 0' }}>{ev.obs}</p>}
        {d.convidado && <p className="mut" style={{ margin: '6px 0 0', fontSize: '.9rem' }}>Acesso de convidado (só para ver)</p>}
        {dono && <div style={{ marginTop: 8 }}><ConviteBotao evento missaId={ev.id} dataHora={ev.data_hora} titulo={ev.nome || ev.tipo} /></div>}
        <div className="row" style={{ marginTop: 10 }}>
          <span className="mut" style={{ fontSize: '.9rem' }}>{!online ? 'Você está sem internet' : ler(chave(id) + ':pagina') ? '✓ Disponível sem internet' : 'Ainda não guardado para uso sem internet'}</span>
          {online && <button className="sec" onClick={baixar} disabled={baixando}>{baixando ? 'Guardando…' : 'Baixar para usar sem internet'}</button>}
        </div>
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
          <span className="mut" style={{ fontSize: '.9rem' }}>Tamanho do texto</span>
          <button type="button" className="sec cer-mini" onClick={() => mudarFonte(-0.1)} aria-label="Diminuir texto">A−</button>
          <button type="button" className="sec cer-mini" onClick={() => mudarFonte(0.1)} aria-label="Aumentar texto">A+</button>
          <span className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            {[['letra', 'Letra'], ['cifra', 'Cifra'], ['grade', 'Grade']].map(([k, t]) => <button key={k} type="button" className={'cer-mini' + (formato === k ? '' : ' sec')} onClick={() => mudarFormato(k)}>{t}</button>)}
          </span>
        </div>
        {algumCapo && (
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
            <span className="mut" style={{ fontSize: '.9rem' }}>Capotraste</span>
            <button type="button" className={'cer-mini' + (usaCapo ? '' : ' sec')} onClick={() => { setUsaCapo(true); gravarPref('missa:capo', true); }}>Usar (violão)</button>
            <button type="button" className={'cer-mini' + (usaCapo ? ' sec' : '')} onClick={() => { setUsaCapo(false); gravarPref('missa:capo', false); }}>Sem capo (teclado)</button>
          </div>
        )}
        <p className="mut" style={{ fontSize: '.8rem', margin: '8px 0 0' }}>Pedal ou teclado: ← rolagem · → próxima música · ↑ ↓ mover o texto</p>
        {msg && <p className={msg.startsWith('Pronto') ? 'okmsg' : 'err'} style={{ margin: '8px 0 0' }}>{msg}</p>}
      </div>

      {itens.length === 0 && <div className="card mut">Nenhuma música na lista. Use “+ Adicionar música” abaixo.</div>}
      {itens.map((it, n) => {
        const m = it.m || {};
        const ativo = aberto === n;
        const tom = it.tom || m.tom_padrao || m.tom_original || '';
        const auto = mostraCifra && tom && m.tom_original ? distancia(m.tom_original, tom) : null;
        const ajuste = ajustes[it.id] || 0;
        const total = (auto || 0) + ajuste;
        const capoMusica = it.capo ?? m.capo ?? 0;
        const capo = mostraCifra && usaCapo ? capoMusica : 0;
        const destino = m.tom_original ? nomeDoTom(m.tom_original, total) : null;
        const forma = m.tom_original ? nomeDoTom(m.tom_original, total - capo) : null;
        const querGrade = formato === 'grade';
        const base = mostraCifra ? (querGrade ? (m.grade || (m.cifra ? gerarGrade(m.cifra) : '') || m.cifra) : m.cifra) : (m.letra || letraDaCifra(m.cifra));
        const texto = base ? (mostraCifra ? transporCifra(base, total - capo, capo ? forma : (ajuste === 0 && auto !== null ? tom : destino)) : base) : '';
        return (
          <div key={it.id} ref={el => { refs.current[n] = el; }} className={'card cer-mom' + (ativo ? ' cer-ativo' : '') + (it.tocada ? ' ev-tocada' : '')}>
            <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'center' }}>
              <button type="button" className="cer-cab" onClick={() => abrir(n)} aria-expanded={ativo} style={{ flex: 1 }}>
                <span className="cer-num">{n + 1}</span>
                <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <span className="cer-momento">{it.tocada ? '✓ já tocada' : 'Música'}</span>
                  <span className="cer-musica">{m.nome || 'Música removida da Biblioteca'}{m.artista ? <span className="mut"> · {m.artista}</span> : null}</span>
                </span>
                <span aria-hidden="true">{ativo ? '▾' : '▸'}</span>
              </button>
            </div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="chips" style={{ marginTop: 0 }}>
                {tom && <span className="chip on" style={{ cursor: 'default' }}>Tom: {tom}</span>}
                {mostraCifra && capoMusica > 0 && <span className="chip on" style={{ cursor: 'default' }}>Capotraste na {capoMusica}ª casa</span>}
              </span>
              {dono && <span className="row" style={{ gap: 6 }}>
                <label className="ev-check"><input type="checkbox" checked={!!it.tocada} onChange={e => marcarTocada(it, e.target.checked)} /> Já toquei</label>
                <button type="button" className="sec cer-mini" onClick={() => mover(n, -1)} disabled={n === 0} aria-label="Subir">▲</button>
                <button type="button" className="sec cer-mini" onClick={() => mover(n, 1)} disabled={n === itens.length - 1} aria-label="Descer">▼</button>
              </span>}
            </div>
            {ativo && (
              <div style={{ marginTop: 12 }}>
                {mostraCifra && base && (
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.9rem' }}>
                      {capo ? <>Capo na <strong>{capo}ª casa</strong> · formas de <strong>{forma || '?'}</strong>{destino ? <span className="mut"> · soa em {destino}</span> : null}</>
                        : destino ? <>Cifra em <strong>{destino}</strong></> : (total ? <>Cifra ajustada <strong>{meioTom(total)}</strong></> : 'Cifra no tom original')}
                      {ajuste ? <span className="mut"> · ajuste manual {meioTom(ajuste)}</span> : null}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      {/* Desfazer vem antes e sempre ocupa o lugar (invisível sem ajuste): os botões de ½ tom não mudam de posição */}
                      <button type="button" className="sec cer-mini" onClick={() => ajustar(it.id, null)} disabled={ajuste === 0} aria-hidden={ajuste === 0} tabIndex={ajuste === 0 ? -1 : 0} style={{ visibility: ajuste === 0 ? 'hidden' : 'visible' }}>Desfazer</button>
                      <button type="button" className="sec cer-mini" onClick={() => ajustar(it.id, -1)}>−½ tom</button>
                      <button type="button" className="sec cer-mini" onClick={() => ajustar(it.id, 1)}>+½ tom</button>
                    </span>
                  </div>
                )}
                {texto ? <pre className={mostraCifra ? 'cer-cifra' : 'cer-letra'} style={{ fontSize: `${(mostraCifra ? 1 : 1.15) * fonte}rem` }}>{destacarPartes(texto, mostraCifra)}</pre>
                  : <p className="mut">{mostraCifra ? 'A cifra desta música ainda não foi cadastrada.' : 'A letra desta música ainda não foi cadastrada.'}</p>}
                <div id={'fim-' + n}>
                  {n < itens.length - 1
                    ? <button className="cer-prox" onClick={() => abrir(n + 1)}>Próxima música ▸ {itens[n + 1].m?.nome || ''}</button>
                    : !dono ? <p className="mut" style={{ textAlign: 'center', marginTop: 16 }}>Fim da lista 🎶</p>
                    : <button className="cer-prox sec" onClick={() => { setAdicionando(true); setAberto(null); setTimeout(() => document.getElementById('ev-adicionar')?.scrollIntoView({ behavior: 'smooth' }), 60); }}>Fim da lista · + Adicionar música</button>}
                </div>
                <Rolagem key={it.id} alvoId={'fim-' + n} />
              </div>
            )}
          </div>
        );
      })}

      {dono && <div id="ev-adicionar" className="card" style={{ borderTopColor: 'var(--azul)' }}>
        {!adicionando
          ? <button type="button" className="cer-prox sec" style={{ marginTop: 0 }} onClick={() => setAdicionando(true)}>+ Adicionar música no fim da lista</button>
          : <>
            <div className="row" style={{ marginBottom: 8 }}><strong>Adicionar música</strong><button type="button" className="sec cer-mini" onClick={() => setAdicionando(false)}>Fechar</button></div>
            {!biblio ? <p className="mut">Abra este evento com internet uma vez para poder buscar músicas.</p>
              : <BuscaMusicas musicas={biblio.musicas} momentos={biblio.momentos} onEscolher={adicionar} jaTem={new Set(itens.map(x => x.musica_id))} autoFocus />}
            {!online && <p className="mut" style={{ marginTop: 8 }}>Sem internet: dá para buscar, mas a música só entra na lista com conexão.</p>}
          </>}
      </div>}
      {dono && <button type="button" className="sec cer-prox" style={{ marginTop: 8 }} onClick={sair}>◂ Sair do modo evento</button>}
    </div>
  );
}
