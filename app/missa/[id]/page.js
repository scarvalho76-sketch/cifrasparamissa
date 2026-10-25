'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dataLonga, dataHoraCurta, dataIso, simples, fmtData } from '@/lib/util';
import ConviteBotao from '@/components/ConviteBotao';
import TextoOracao from '@/components/TextoOracao';
import { transporCifra, distancia, nomeDoTom, lerTom, gerarGrade, letraDaCifra } from '@/lib/musica';

// Modo celebração: só aquela missa, momento a momento (adaptado do Modo cerimônia do Sonata Casamentos).
// Quem só canta vê a letra; quem toca vê a cifra ou a grade. Cada um pode trocar.
// Os dados ficam guardados no aparelho para abrir sem internet.

const CACHE = 'missa-celebracao-v1';
const chaveLocal = id => 'missa:' + id;
const dt = dataLonga;
const quando = dataHoraCurta;
const partes = i => String(i || '').split(/\s+e\s+/i).map(s => s.trim()).filter(Boolean);
const tocaAlgo = i => partes(i).some(p => !/voz/i.test(p));

// Data (aaaa-mm-dd) no horário de Brasília, para conferir o "dia da celebração"
const diaBrasilia = s => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(s));

// Convidado: depois do dia da celebração (o link vale até esse dia), apaga deste aparelho tudo o que foi guardado desta missa
async function apagarCopiaDoConvidado(id) {
  try {
    [chaveLocal(id), chaveLocal(id) + ':leituras', chaveLocal(id) + ':pagina', chaveLocal(id) + ':ajustes', 'missa:convite:' + id]
      .forEach(k => localStorage.removeItem(k));
    // sem link de músico nem outra missa de convidado guardada, a Biblioteca também sai
    const outros = Object.keys(localStorage).some(k => k.startsWith('missa:convite:'));
    if (!localStorage.getItem('missa:token') && !outros) localStorage.removeItem('missa:biblioteca');
  } catch {}
  try { if ('caches' in window) { const c = await caches.open(CACHE); await c.delete('/missa/' + id, { ignoreSearch: true }); } } catch {}
}

function lerLocal(id) {
  try { const s = localStorage.getItem(chaveLocal(id)); return s ? JSON.parse(s) : null; } catch { return null; }
}
function gravarLocal(id, dados) {
  try { localStorage.setItem(chaveLocal(id), JSON.stringify({ ...dados, salvo_em: new Date().toISOString() })); } catch {}
}

// Guarda a própria página e os arquivos dela no aparelho (para abrir sem internet)
async function guardarPagina() {
  if (!('serviceWorker' in navigator) || !('caches' in window)) throw new Error('Este navegador não permite guardar a página para uso sem internet.');
  await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const arquivos = performance.getEntriesByType('resource').map(r => r.name)
    .filter(u => u.startsWith(location.origin) && new URL(u).pathname.startsWith('/_next/static/'));
  const cache = await caches.open(CACHE);
  // também a tela do músico (lista das missas), com os arquivos dela
  const tk = localStorage.getItem('missa:token');
  const extras = [];
  if (tk) {
    extras.push('/m/' + tk);
    try {
      const html = await (await fetch('/m/' + tk)).text();
      extras.push(...(html.match(/\/_next\/static\/[\w\-.\/~%]+\.(?:js|css)/g) || []));
    } catch {}
  }
  await cache.addAll([...new Set([location.pathname, '/emblema.webp', ...arquivos])]);
  // a tela do músico é um extra: se algum arquivo falhar, a missa continua guardada
  await Promise.all([...new Set(extras)].map(u => cache.add(u).catch(() => {})));
}

function lerPref(k, padrao) { try { const v = localStorage.getItem(k); return v === null ? padrao : JSON.parse(v); } catch { return padrao; } }
function gravarPref(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }

// Mantém a tela acesa enquanto a página estiver aberta (quando o aparelho permite)
function useTelaAcesa() {
  useEffect(() => {
    let trava = null; let ativo = true;
    const pedir = async () => { try { if (ativo && document.visibilityState === 'visible' && 'wakeLock' in navigator) trava = await navigator.wakeLock.request('screen'); } catch {} };
    pedir();
    const vis = () => { if (document.visibilityState === 'visible') pedir(); };
    document.addEventListener('visibilitychange', vis);
    return () => { ativo = false; document.removeEventListener('visibilitychange', vis); try { trava?.release(); } catch {} };
  }, []);
}

const meioTom = n => (n > 0 ? '+' : '') + (n / 2).toLocaleString('pt-BR') + ' tom';

// Rolagem automática do momento aberto: rola a tela até o botão do próximo momento aparecer.
// Velocidade de 1 a 10, lembrada no aparelho. Tocar no texto também pausa/retoma.
const PX_POR_SEG = v => Math.round(6 * Math.pow(1.38, v - 1)); // 1 ≈ 6 px/s … 10 ≈ 110 px/s
function Rolagem({ alvoId }) {
  const [rolando, setRolando] = useState(false);
  const [vel, setVel] = useState(4);
  const barra = useRef(null);
  const estado = useRef({ resto: 0, ultimo: 0, quadro: 0 });
  useEffect(() => { setVel(lerPref('missa:rolagem', 4)); }, []);
  const mudarVel = d => setVel(v => { const n = Math.min(10, Math.max(1, v + d)); gravarPref('missa:rolagem', n); return n; });

  const chegou = () => {
    const alvo = document.getElementById(alvoId);
    const alturaBarra = barra.current?.offsetHeight || 60;
    const fimDaPagina = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
    return fimDaPagina || (alvo && alvo.getBoundingClientRect().bottom <= window.innerHeight - alturaBarra - 12);
  };

  useEffect(() => {
    if (!rolando) return;
    const e = estado.current; e.ultimo = 0; e.resto = 0;
    const passo = t => {
      if (!e.ultimo) e.ultimo = t;
      const dt = Math.min(0.1, (t - e.ultimo) / 1000); e.ultimo = t;
      e.resto += PX_POR_SEG(vel) * dt;
      const px = Math.floor(e.resto);
      if (px >= 1) { window.scrollBy(0, px); e.resto -= px; }
      if (chegou()) { setRolando(false); return; }
      e.quadro = requestAnimationFrame(passo);
    };
    e.quadro = requestAnimationFrame(passo);
    // tocar no texto da música pausa
    const tocar = ev => { if (!barra.current?.contains(ev.target)) setRolando(false); };
    const sumiu = () => { if (document.visibilityState !== 'visible') setRolando(false); };
    document.addEventListener('pointerdown', tocar); document.addEventListener('visibilitychange', sumiu);
    return () => { cancelAnimationFrame(e.quadro); document.removeEventListener('pointerdown', tocar); document.removeEventListener('visibilitychange', sumiu); };
  }, [rolando, vel, alvoId]);

  function alternar() {
    if (rolando) return setRolando(false);
    if (chegou()) { // já no fim: volta ao começo do momento antes de rolar
      const card = document.getElementById(alvoId)?.closest('.cer-mom');
      if (card) window.scrollTo({ top: card.getBoundingClientRect().top + window.scrollY - 8 });
    }
    setRolando(true);
  }

  return (
    <div ref={barra} className="cer-rolagem" role="group" aria-label="Rolagem automática">
      <button type="button" className={'cer-mini' + (rolando ? '' : ' sec')} onClick={alternar} style={{ minWidth: 104 }}>{rolando ? '⏸ Pausar' : '▶ Rolar'}</button>
      <span className="mut" style={{ fontSize: '.85rem', marginLeft: 'auto' }}>Velocidade</span>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(-1)} aria-label="Mais devagar" disabled={vel <= 1}>−</button>
      <strong style={{ minWidth: 18, textAlign: 'center' }}>{vel}</strong>
      <button type="button" className="sec cer-mini" onClick={() => mudarVel(1)} aria-label="Mais rápido" disabled={vel >= 10}>+</button>
    </div>
  );
}

// Música durante a homilia: busca na Biblioteca, sem registrar na missa
function BuscaAvulsa({ biblioteca, escolhida, onEscolher }) {
  const [busca, setBusca] = useState('');
  if (escolhida) return (
    <div className="row" style={{ marginBottom: 8 }}>
      <span className="mut" style={{ fontSize: '.9rem' }}>Música escolhida só para agora (não fica registrada na missa)</span>
      <button type="button" className="sec cer-mini" onClick={() => onEscolher(null)}>Trocar música</button>
    </div>
  );
  if (!biblioteca) return <p className="mut">Abra esta missa com internet uma vez para poder buscar músicas.</p>;
  const t = simples(busca);
  // fora da lista: músicas do Ato penitencial, Glória, Santo e Cordeiro (partes fixas da missa)
  const fixa = m => (m.momentos || []).some(n => /^(ato penitencial|gl[oó]ria|santo|cordeiro)$/i.test(String(n).trim()));
  const achadas = t ? biblioteca.filter(m => !fixa(m) && simples(m.nome + ' ' + m.artista).includes(t)).slice(0, 12) : [];
  return (
    <div style={{ marginBottom: 8 }}>
      <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Digite o nome da música" autoComplete="off" style={{ marginBottom: 6 }} />
      {t && achadas.length === 0 && <p className="mut">Nenhuma música encontrada.</p>}
      {achadas.map(m => (
        <button key={m.id} type="button" className="sec cer-achada" onClick={() => onEscolher(m.id)}>
          <strong>{m.nome}</strong>{m.artista ? <span className="mut"> · {m.artista}</span> : null}
        </button>
      ))}
    </div>
  );
}

// Partes entre colchetes ([Refrão], [Intro], [Final]...) em negrito
function destacarPartes(texto) {
  return String(texto).split(/(\[[^\]\n]+\])/).map((t, k) => k % 2 ? <strong key={k} className="cer-parte">{t}</strong> : t);
}

function Selo({ children, forte }) {
  return <span className={'chip' + (forte ? ' on' : '')} style={{ cursor: 'default' }}>{children}</span>;
}

export default function Cerimonia() {
  const { id: escala } = useParams();
  const [token, setToken] = useState(null);
  const [convite, setConvite] = useState(null); // link de convidado (vale até o dia da celebração)
  const [d, setD] = useState(undefined);
  const [erro, setErro] = useState('');
  const [online, setOnline] = useState(true);
  const [aberto, setAberto] = useState(null);
  const [baixado, setBaixado] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [msg, setMsg] = useState('');
  const refs = useRef({});
  const [ajustes, setAjustes] = useState({});
  const [fonte, setFonte] = useState(1);
  const [formato, setFormato] = useState(null);
  const [usaCapo, setUsaCapo] = useState(null);
  const [leituras, setLeituras] = useState(null); // da Liturgia Diária (CNBB), guardadas só no aparelho
  const [salmo, setSalmo] = useState(null);
  const [biblioteca, setBiblioteca] = useState(null); // para a música avulsa
  const [avulsa, setAvulsa] = useState(null);
  const [oeSel, setOeSel] = useState(null);       // Oração Eucarística escolhida na hora
  const [voltarOE, setVoltarOE] = useState(false); // veio da Oração para o Santo cantado
  useTelaAcesa();
  useEffect(() => {
    setAjustes(lerPref(chaveLocal(escala) + ':ajustes', {}));
    setFonte(lerPref('missa:fonte', 1));
    setFormato(lerPref('missa:formato', null));
    setUsaCapo(lerPref('missa:capo', null));
    setOeSel(lerPref(chaveLocal(escala) + ':oe', null));
  }, [escala]);
  const ajustar = (id, delta) => {
    const novo = { ...ajustes, [id]: delta === null ? 0 : (ajustes[id] || 0) + delta };
    setAjustes(novo); gravarPref(chaveLocal(escala) + ':ajustes', novo);
  };
  const mudarFonte = delta => { const v = Math.min(2, Math.max(0.7, Math.round((fonte + delta) * 10) / 10)); setFonte(v); gravarPref('missa:fonte', v); };
  const mudarFormato = v => { setFormato(v); gravarPref('missa:formato', v); };
  const mudarCapo = v => { setUsaCapo(v); gravarPref('missa:capo', v); };

  // Leituras do dia (primeira, segunda quando houver, Evangelho), consultadas no site da CNBB
  async function carregarLeituras(dataHora) {
    try {
      const r = await fetch(`/api/liturgia?data=${dataIso(dataHora)}&completo=1`);
      if (!r.ok) return;
      const l = await r.json();
      if (!l?.leituras?.length && !l?.salmo) return;
      setLeituras(l.leituras || []); setSalmo(l.salmo || null);
      try { localStorage.setItem(chaveLocal(escala) + ':leituras', JSON.stringify({ data: dataIso(dataHora), leituras: l.leituras, salmo: l.salmo })); } catch {}
    } catch {}
  }

  // Biblioteca para a música avulsa: consultada com internet e guardada no aparelho
  async function carregarBiblioteca(tk, cv) {
    try {
      const { data, error } = await supabase.rpc('missa_biblioteca', { p_token: tk, p_convite: cv || null });
      if (error || !Array.isArray(data)) return;
      setBiblioteca(data);
      try { localStorage.setItem('missa:biblioteca', JSON.stringify(data)); } catch {}
    } catch {}
  }

  useEffect(() => {
    // Convidado com cópia guardada de um dia que já passou: apaga antes de mostrar qualquer coisa
    let cvGuardado = null; try { cvGuardado = new URLSearchParams(location.search).get('c') || localStorage.getItem('missa:convite:' + escala); } catch {}
    const copia = lerLocal(escala);
    let tkMusico = null; try { tkMusico = localStorage.getItem('missa:token'); } catch {}
    const ehDono = copia && (copia.pode_convidar || (!copia.convidado && tkMusico));
    if (cvGuardado && copia && !ehDono && diaBrasilia(Date.now()) > diaBrasilia(copia.data_hora)) {
      apagarCopiaDoConvidado(escala);
      setConvite(cvGuardado);
      setErro('Este link de convidado venceu: ele valia até o dia da celebração. A cópia guardada neste aparelho foi apagada.');
      setD(null);
      return;
    }
    try { const b = JSON.parse(localStorage.getItem('missa:biblioteca') || 'null'); if (Array.isArray(b)) setBiblioteca(b); } catch {}
    const local = lerLocal(escala);
    if (local) setD(local);
    try { const g = JSON.parse(localStorage.getItem(chaveLocal(escala) + ':leituras') || 'null'); if (g && local && g.data === dataIso(local.data_hora)) { setLeituras(g.leituras); setSalmo(g.salmo || null); } } catch {}
    try { setBaixado(localStorage.getItem(chaveLocal(escala) + ':pagina') === '1'); } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);

    (async () => {
      try {
        let tk = null; try { tk = localStorage.getItem('missa:token'); } catch {}
        setToken(tk);
        // convidado: código do link (?c=...), guardado no aparelho para abrir de novo
        let cv = new URLSearchParams(location.search).get('c');
        try { if (cv) localStorage.setItem('missa:convite:' + escala, cv); else cv = localStorage.getItem('missa:convite:' + escala); } catch {}
        setConvite(cv);
        const { data, error } = await supabase.rpc('missa_dados', { p_id: escala, p_token: tk, p_convite: cv || null });
        if (error) throw error;
        setD(data); gravarLocal(escala, data); setErro('');
        carregarLeituras(data.data_hora);
        carregarBiblioteca(tk, cv);
      } catch (e) {
        if (!local) setErro(navigator.onLine ? (e.message || 'Não foi possível abrir.') : 'Sem internet e esta missa ainda não foi guardada neste aparelho.');
      }
    })();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [escala]);

  async function baixar() {
    setMsg(''); setBaixando(true);
    try {
      const { data, error } = await supabase.rpc('missa_dados', { p_id: escala, p_token: token, p_convite: convite });
      if (error) throw error;
      setD(data); gravarLocal(escala, data);
      await carregarLeituras(data.data_hora);
      await carregarBiblioteca(token, convite);
      await guardarPagina();
      try { localStorage.setItem(chaveLocal(escala) + ':pagina', '1'); } catch {}
      setBaixado(true); setMsg('Pronto: esta missa abre neste aparelho mesmo sem internet.');
    } catch (e) {
      setMsg('Não foi possível guardar agora: ' + (e.message || 'tente de novo com internet.'));
    }
    setBaixando(false);
  }

  // Volta para a tela de onde veio (painel ou tela do músico)
  function sair() {
    if (document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1) history.back();
    else location.href = token ? '/m/' + token : '/painel';
  }

  function abrir(i) {
    const novo = aberto === i ? null : i;
    setAberto(novo);
    if (novo !== null) setTimeout(() => refs.current[novo]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  if (d === undefined && !erro) return <div className="wrap">Carregando…</div>;
  if (!d) return (
    <div className="wrap"><div className="card" style={{ marginTop: 24 }}>
      <h1>Modo celebração</h1><p className="err">{erro}</p>
      <p className="mut">{convite ? 'Peça um novo link a quem compartilhou esta missa.' : 'Abra pelo seu link pessoal, com internet, e toque em “Baixar para usar sem internet”.'}</p>
    </div></div>
  );

  const instr = d.instrumento;
  // Padrão: quem só canta vê a letra; quem toca (ou o administrador) vê a cifra
  const padrao = !instr ? 'cifra' : (tocaAlgo(instr) ? 'cifra' : 'letra');
  const visao = formato || padrao;
  const mostraCifra = visao !== 'letra';
  let itens = d.itens || [];
  // Salmo do dia (CNBB): se a missa não tem o momento Salmo, ele entra na posição 4
  const ehSalmo = i => /^salmo/i.test(i.momento || '');
  if (salmo && !itens.some(ehSalmo)) {
    const v = { id: 'salmo-cnbb', momento: 'Salmo', numero: 4, obs: '' };
    const k = itens.findIndex(i => i.numero && i.numero > 4);
    itens = k >= 0 ? [...itens.slice(0, k), v, ...itens.slice(k)] : [...itens, v];
  }
  // Leituras do dia na ordem da missa: Primeira antes do Salmo (4), Segunda depois do Salmo,
  // Evangelho depois da Aclamação (5)
  const antesDoNumero = (lim, v) => { const k = itens.findIndex(i => i.numero && i.numero >= lim); itens = k >= 0 ? [...itens.slice(0, k), v, ...itens.slice(k)] : [...itens, v]; };
  for (const L of leituras || []) {
    const v = { id: 'leitura-' + L.tipo, leitura: L, momento: L.titulo, numero: null };
    antesDoNumero(L.tipo === 'primeira' ? 4 : L.tipo === 'segunda' ? 5 : 6, v);
  }
  // Música durante a homilia: seção sem número entre a Aclamação (5) e o Ofertório (6)
  const escolhida = avulsa && biblioteca ? biblioteca.find(m => m.id === avulsa) : null;
  {
    const v = { id: escolhida ? 'avulsa-' + escolhida.id : 'avulsa', momento: 'Música durante a homilia', numero: null, obs: '', avulsa: true,
      ...(escolhida ? { nome: escolhida.nome, artista: escolhida.artista, cifra: escolhida.cifra, letra: escolhida.letra, grade: escolhida.grade,
        tom_original: escolhida.tom_original, tom: escolhida.tom_padrao || escolhida.tom_original, capo: escolhida.capo || 0 } : {}) };
    const ev = itens.findIndex(i => i.leitura?.tipo === 'evangelho');
    const k = ev >= 0 ? ev + 1 : itens.findIndex(i => i.numero && i.numero > 5);
    itens = k >= 0 ? [...itens.slice(0, k), v, ...itens.slice(k)] : [...itens, v];
  }
  // Oração Eucarística: seção sem número entre o Ofertório (6) e o Santo (7)
  const oracoes = (d.oracoes || []).filter(o => o.sigla !== 'SANTO');
  const santoRezado = (d.oracoes || []).find(o => o.sigla === 'SANTO')?.texto || '';
  if (oracoes.length) antesDoNumero(7, { id: 'oe', oe: true, momento: 'Oração Eucarística', numero: null });
  const idxOE = itens.findIndex(x => x.oe);
  const idxSanto = itens.findIndex(x => !x.oe && /^santo/i.test(x.momento || ''));
  const escolherOE = s => { setOeSel(s); gravarPref(chaveLocal(escala) + ':oe', s); };
  function voltarParaOracao() {
    setVoltarOE(false); setAberto(idxOE);
    setTimeout(() => (document.getElementById('oe-santo') || refs.current[idxOE])?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }
  // Capotraste: quem toca violão vê as formas dos acordes com o capo; tecladista vê a cifra no tom real
  const soTeclado = /teclado|piano|órg[aã]o|orgao/i.test(instr || '') && !/viol/i.test(instr || '');
  const comCapo = usaCapo ?? !soTeclado;
  const algumCapo = mostraCifra && itens.some(i => i.capo > 0);

  return (
    <div className="wrap cer">
      <div className="card">
        <div className="mut">{dt(d.data_hora)}</div>
        <h1 style={{ marginTop: 4 }}>{d.titulo || 'Missa'}</h1>
        <div className="mut">{[d.local, d.tempo].filter(Boolean).join(' · ')}{instr ? ` · ${d.musico} (${instr})` : ''}{d.convidado ? ` · acesso de convidado (até ${fmtData(d.data_hora)})` : ''}</div>
        {d.pode_convidar && <div style={{ marginTop: 8 }}><ConviteBotao missaId={d.id} dataHora={d.data_hora} titulo={d.titulo} /></div>}
        <div className="row" style={{ marginTop: 10 }}>
          <span className={baixado ? 'okmsg' : 'mut'} style={{ fontSize: '.9rem' }}>
            {baixado ? '✓ Disponível sem internet' : 'Ainda não guardada para uso sem internet'}
            {!online && ' · você está sem internet'}
            {d.salvo_em && !online ? ` · versão de ${quando(d.salvo_em)}` : ''}
          </span>
          {online && <button className="sec" onClick={baixar} disabled={baixando}>{baixando ? 'Guardando…' : baixado ? 'Atualizar' : 'Baixar para usar sem internet'}</button>}
        </div>
        {msg && <p className={msg.startsWith('Pronto') ? 'okmsg' : 'err'}>{msg}</p>}
        <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
          <span className="mut" style={{ fontSize: '.9rem' }}>Tamanho do texto</span>
          <button type="button" className="sec cer-mini" onClick={() => mudarFonte(-0.1)} aria-label="Diminuir texto">A−</button>
          <button type="button" className="sec cer-mini" onClick={() => mudarFonte(0.1)} aria-label="Aumentar texto">A+</button>
          <span className="row" style={{ gap: 6, marginLeft: 'auto' }}>
            {[['letra', 'Letra'], ['cifra', 'Cifra'], ['grade', 'Grade']].map(([k, t]) => (
              <button key={k} type="button" className={'cer-mini' + (visao === k ? '' : ' sec')} onClick={() => mudarFormato(k)}>{t}</button>
            ))}
          </span>
        </div>
        {algumCapo && (
          <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
            <span className="mut" style={{ fontSize: '.9rem' }}>Capotraste</span>
            <button type="button" className={'cer-mini' + (comCapo ? '' : ' sec')} onClick={() => mudarCapo(true)}>Usar (violão)</button>
            <button type="button" className={'cer-mini' + (comCapo ? ' sec' : '')} onClick={() => mudarCapo(false)}>Sem capo (teclado)</button>
          </div>
        )}
      </div>

      {itens.map((i, n) => {
        // Oração Eucarística (escolhida na hora), com o Santo rezado no lugar e o atalho para o Santo cantado
        if (i.oe) {
          const ativo = aberto === n;
          const sel = oracoes.find(o => o.sigla === oeSel);
          const prox = itens[n + 1] && n + 1 === idxSanto ? n + 2 : n + 1;
          const temSantoCantado = idxSanto >= 0 && itens[idxSanto].nome;
          return (
            <div key={i.id} ref={el => { refs.current[n] = el; }} className={'card cer-mom' + (ativo ? ' cer-ativo' : '')}>
              <button type="button" className="cer-cab" onClick={() => abrir(n)} aria-expanded={ativo}>
                <span className="cer-num cer-sem">✦</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="cer-momento">Oração Eucarística</span>
                  <span className="cer-musica">{sel ? sel.nome : <span className="mut">Escolha a oração</span>}</span>
                </span>
                <span aria-hidden="true">{ativo ? '▾' : '▸'}</span>
              </button>
              {ativo && (
                <div style={{ marginTop: 10 }}>
                  <div className="oe-chips" role="group" aria-label="Escolher a Oração Eucarística">
                    {oracoes.map(o => <button key={o.sigla} type="button" className={oeSel === o.sigla ? '' : 'sec'} onClick={() => escolherOE(o.sigla)}>{o.sigla}</button>)}
                  </div>
                  {sel ? <TextoOracao texto={sel.texto} santo={santoRezado} fonte={fonte} onSantoCantado={temSantoCantado ? () => { setVoltarOE(true); setAberto(idxSanto); setTimeout(() => refs.current[idxSanto]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); } : null} />
                    : <p className="mut">Toque na oração que o padre começar.</p>}
                  <div id={'fim-' + n}>
                    {itens[prox] && <button className="cer-prox" onClick={() => abrir(prox)}>Próximo momento ▸ {itens[prox].momento}</button>}
                  </div>
                  <Rolagem key={i.id} alvoId={'fim-' + n} />
                </div>
              )}
            </div>
          );
        }
        // Leituras intercaladas com os momentos (Primeira antes do Salmo, Segunda depois, Evangelho após a Aclamação)
        if (i.leitura) {
          const L = i.leitura;
          const ativo = aberto === n;
          return (
            <div key={i.id} ref={el => { refs.current[n] = el; }} className={'card cer-mom cer-leitura' + (ativo ? ' cer-ativo' : '')}>
              <button type="button" className="cer-cab" onClick={() => abrir(n)} aria-expanded={ativo}>
                <span className="cer-num cer-sem">{L.tipo === 'evangelho' ? '✝' : L.tipo === 'primeira' ? 'I' : 'II'}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span className="cer-momento">{L.titulo}</span>
                  <span className="cer-musica">{L.sigla || L.referencia || L.abertura}</span>
                </span>
                <span aria-hidden="true">{ativo ? '▾' : '▸'}</span>
              </button>
              {L.resumo && <p className="cer-obs">{L.resumo}</p>}
              {ativo && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 600 }}>{L.abertura} <span className="mut">{L.referencia}</span></p>
                  <pre className="cer-letra" style={{ fontSize: `${1.05 * fonte}rem` }}>{L.texto}</pre>
                  <p className="mut" style={{ fontSize: '.8rem', margin: '6px 0 0' }}>Fonte: <a href="https://liturgiadiaria.edicoescnbb.com.br/" target="_blank" rel="noreferrer">Liturgia Diária · Edições CNBB</a></p>
                  <div id={'fim-' + n}>
                    {n < itens.length - 1 && <button className="cer-prox" onClick={() => abrir(n + 1)}>Próximo ▸ {itens[n + 1].momento}</button>}
                  </div>
                  <Rolagem key={i.id} alvoId={'fim-' + n} />
                </div>
              )}
            </div>
          );
        }
        // Transposição: do tom em que a cifra foi escrita para o tom do cantor, mais o ajuste manual
        const auto = mostraCifra && i.tom && i.tom_original ? distancia(i.tom_original, i.tom) : null;
        const ajuste = ajustes[i.id] || 0;
        const total = (auto || 0) + ajuste;
        const destino = i.tom_original ? nomeDoTom(i.tom_original, total) : null;
        // com capotraste, os acordes mostrados são as formas: tom real menos as casas do capo
        const capo = mostraCifra && comCapo ? (i.capo || 0) : 0;
        const forma = i.tom_original ? nomeDoTom(i.tom_original, total - capo) : null;
        // Grade: a cadastrada na Biblioteca; se não houver, gerada na hora a partir da cifra
        const querGrade = visao === 'grade';
        const gradeAuto = querGrade && !i.grade && i.cifra ? gerarGrade(i.cifra) : '';
        // letra: a cadastrada; se não houver, a própria cifra sem as linhas de acordes
        const letraVista = i.letra || letraDaCifra(i.cifra);
        const base = mostraCifra ? (querGrade ? (i.grade || gradeAuto || i.cifra) : i.cifra) : letraVista;
        const texto = mostraCifra ? transporCifra(base, total - capo, capo ? forma : (ajuste === 0 && auto !== null ? i.tom : destino)) : base;
        const falta = i.avulsa && !i.nome ? '' : !i.nome ? 'Nenhuma música escolhida para este momento.' : mostraCifra ? 'A cifra desta música ainda não foi cadastrada.' : 'A letra desta música ainda não foi cadastrada.';
        let aviso = '';
        if (mostraCifra && i.cifra && i.tom && !i.tom_original) aviso = 'O tom original desta cifra não foi cadastrado, por isso ela não foi transposta automaticamente. Use os botões de meio tom se precisar.';
        else if (mostraCifra && i.cifra && i.tom && i.tom_original && auto === null) aviso = `Não foi possível transpor automaticamente (tom: “${i.tom}”). A cifra está no tom original${lerTom(i.tom_original) ? ` (${i.tom_original})` : ''}.`;
        const ativo = aberto === n;
        return (
          <div key={i.id} ref={el => { refs.current[n] = el; }} className={'card cer-mom' + (ativo ? ' cer-ativo' : '')}>
            <button type="button" className="cer-cab" onClick={() => abrir(n)} aria-expanded={ativo}>
              <span className={'cer-num' + (i.numero ? '' : ' cer-sem')}>{i.numero || (i.avulsa ? '♪' : '✦')}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="cer-momento">{i.momento}</span>
                <span className="cer-musica">{i.nome || (i.avulsa ? <span className="mut">Buscar música por nome</span> : salmo && ehSalmo(i) ? salmo.referencia || 'Salmo do dia' : <span className="mut">sem música escolhida</span>)}{i.nome && i.artista ? <span className="mut"> · {i.artista}</span> : null}</span>
              </span>
              <span aria-hidden="true">{ativo ? '▾' : '▸'}</span>
            </button>
            <div className="chips" style={{ marginTop: 6 }}>
              {i.tom && <Selo forte>Tom: {i.tom}</Selo>}
              {mostraCifra && i.capo > 0 && <Selo forte>Capotraste na {i.capo}ª casa</Selo>}
              {i.obs && i.obs.length <= 40 && <Selo forte>{i.obs}</Selo>}
            </div>
            {salmo && ehSalmo(i) && salmo.refrao && <p className="cer-obs"><strong>R.</strong> {salmo.refrao}</p>}
            {i.obs && i.obs.length > 40 && <p className="cer-obs">{/^aclama/i.test(i.momento) ? <><strong>V.</strong> </> : null}{i.obs}</p>}
            {ativo && (
              <div style={{ marginTop: 12 }}>
                {i.avulsa && <BuscaAvulsa biblioteca={biblioteca} escolhida={escolhida}
                  onEscolher={id => { setAvulsa(id); setTimeout(() => refs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); }} />}
                {voltarOE && n === idxSanto && idxOE >= 0 && <button type="button" className="sec cer-prox" style={{ marginTop: 0, marginBottom: 10 }} onClick={voltarParaOracao}>◂ Voltar à Oração Eucarística</button>}
                {mostraCifra && base && (
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: '.9rem' }}>
                      {capo ? <>Capo na <strong>{capo}ª casa</strong> · formas de <strong>{forma || '?'}</strong>{destino ? <span className="mut"> · soa em {destino}</span> : null}</>
                        : destino ? <>Cifra em <strong>{destino}</strong></> : (total ? <>Cifra ajustada <strong>{meioTom(total)}</strong></> : 'Cifra no tom original')}
                      {auto && !capo ? <span className="mut"> · transposta de {i.tom_original}</span> : null}
                      {ajuste ? <span className="mut"> · ajuste manual {meioTom(ajuste)}</span> : null}
                    </span>
                    <span className="row" style={{ gap: 6 }}>
                      <button type="button" className="sec cer-mini" onClick={() => ajustar(i.id, -1)}>−½ tom</button>
                      <button type="button" className="sec cer-mini" onClick={() => ajustar(i.id, 1)}>+½ tom</button>
                      {ajuste !== 0 && <button type="button" className="sec cer-mini" onClick={() => ajustar(i.id, null)}>Desfazer</button>}
                    </span>
                  </div>
                )}
                {aviso && <p className="err" style={{ fontSize: '.9rem' }}>{aviso}</p>}
                {gradeAuto && <p className="mut" style={{ fontSize: '.9rem' }}>Grade montada automaticamente a partir da cifra, com um acorde por compasso: pode não corresponder aos compassos reais.</p>}
                {querGrade && !i.grade && !gradeAuto && i.cifra && <p className="mut" style={{ fontSize: '.9rem' }}>Não foi possível montar a grade desta cifra; mostrando a cifra.</p>}
                {texto ? <pre className={mostraCifra ? 'cer-cifra' : 'cer-letra'} style={{ fontSize: `${(mostraCifra ? 1 : 1.15) * fonte}rem` }}>{destacarPartes(texto)}</pre> : !(salmo && ehSalmo(i)) && falta && <p className="mut">{falta}</p>}
                {salmo && ehSalmo(i) && (
                  <div style={{ marginTop: texto ? 14 : 0 }}>
                    <p style={{ margin: '0 0 8px', fontWeight: 600 }}>Salmo do dia <span className="mut">{salmo.referencia}</span></p>
                    <pre className="cer-letra" style={{ fontSize: `${1.05 * fonte}rem` }}>{'R. ' + salmo.refrao + '\n\n' + salmo.texto}</pre>
                    <p className="mut" style={{ fontSize: '.8rem', margin: '6px 0 0' }}>Fonte: <a href="https://liturgiadiaria.edicoescnbb.com.br/" target="_blank" rel="noreferrer">Liturgia Diária · Edições CNBB</a></p>
                  </div>
                )}
                <div id={'fim-' + n}>
                  {n < itens.length - 1
                    ? (voltarOE && n === idxSanto && idxOE >= 0
                      ? <button className="cer-prox" onClick={voltarParaOracao}>◂ Voltar à Oração Eucarística</button>
                      : <button className="cer-prox" onClick={() => abrir(n + 1)}>Próximo momento ▸ {itens[n + 1].momento}</button>)
                    : <p className="mut" style={{ textAlign: 'center', marginTop: 16 }}>Fim do roteiro 🎶</p>}
                </div>
                <Rolagem key={i.id} alvoId={'fim-' + n} />
              </div>
            )}
          </div>
        );
      })}
      {d.obs && <div className="card"><strong>Observações</strong><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{d.obs}</p></div>}
      {!d.convidado && <button type="button" className="sec cer-prox" style={{ marginTop: 8 }} onClick={sair}>◂ Sair do modo celebração</button>}
    </div>
  );
}
