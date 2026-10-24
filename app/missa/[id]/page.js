'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { dataLonga, dataHoraCurta, dataIso } from '@/lib/util';
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

function Selo({ children, forte }) {
  return <span className={'chip' + (forte ? ' on' : '')} style={{ cursor: 'default' }}>{children}</span>;
}

export default function Cerimonia() {
  const { id: escala } = useParams();
  const [token, setToken] = useState(null);
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
  useTelaAcesa();
  useEffect(() => {
    setAjustes(lerPref(chaveLocal(escala) + ':ajustes', {}));
    setFonte(lerPref('missa:fonte', 1));
    setFormato(lerPref('missa:formato', null));
    setUsaCapo(lerPref('missa:capo', null));
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
      if (!l?.leituras?.length) return;
      setLeituras(l.leituras);
      try { localStorage.setItem(chaveLocal(escala) + ':leituras', JSON.stringify({ data: dataIso(dataHora), leituras: l.leituras })); } catch {}
    } catch {}
  }

  useEffect(() => {
    const local = lerLocal(escala);
    if (local) setD(local);
    try { const g = JSON.parse(localStorage.getItem(chaveLocal(escala) + ':leituras') || 'null'); if (g && local && g.data === dataIso(local.data_hora)) setLeituras(g.leituras); } catch {}
    try { setBaixado(localStorage.getItem(chaveLocal(escala) + ':pagina') === '1'); } catch {}
    setOnline(navigator.onLine);
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);

    (async () => {
      try {
        let tk = null; try { tk = localStorage.getItem('missa:token'); } catch {}
        setToken(tk);
        const { data, error } = await supabase.rpc('missa_dados', { p_id: escala, p_token: tk });
        if (error) throw error;
        setD(data); gravarLocal(escala, data); setErro('');
        carregarLeituras(data.data_hora);
      } catch (e) {
        if (!local) setErro(navigator.onLine ? (e.message || 'Não foi possível abrir.') : 'Sem internet e esta missa ainda não foi guardada neste aparelho.');
      }
    })();
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, [escala]);

  async function baixar() {
    setMsg(''); setBaixando(true);
    try {
      const { data, error } = await supabase.rpc('missa_dados', { p_id: escala, p_token: token });
      if (error) throw error;
      setD(data); gravarLocal(escala, data);
      await carregarLeituras(data.data_hora);
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
      <p className="mut">Abra pelo seu link pessoal, com internet, e toque em “Baixar para usar sem internet”.</p>
    </div></div>
  );

  const instr = d.instrumento;
  // Padrão: quem só canta vê a letra; quem toca (ou o administrador) vê a cifra
  const padrao = !instr ? 'cifra' : (tocaAlgo(instr) ? 'cifra' : 'letra');
  const visao = formato || padrao;
  const mostraCifra = visao !== 'letra';
  const itens = d.itens || [];
  // Capotraste: quem toca violão vê as formas dos acordes com o capo; tecladista vê a cifra no tom real
  const soTeclado = /teclado|piano|órg[aã]o|orgao/i.test(instr || '') && !/viol/i.test(instr || '');
  const comCapo = usaCapo ?? !soTeclado;
  const algumCapo = mostraCifra && itens.some(i => i.capo > 0);

  return (
    <div className="wrap cer">
      <div className="card">
        <div className="mut">{dt(d.data_hora)}</div>
        <h1 style={{ marginTop: 4 }}>{d.titulo || 'Missa'}</h1>
        <div className="mut">{[d.local, d.tempo].filter(Boolean).join(' · ')}{instr ? ` · ${d.musico} (${instr})` : ''}</div>
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

      {(leituras || []).map((L, k) => {
        const chave = 'L' + k;
        const ativo = aberto === chave;
        const proxima = leituras[k + 1];
        return (
          <div key={chave} ref={el => { refs.current[chave] = el; }} className={'card cer-mom cer-leitura' + (ativo ? ' cer-ativo' : '')}>
            <button type="button" className="cer-cab" onClick={() => abrir(chave)} aria-expanded={ativo}>
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
                {proxima
                  ? <button className="cer-prox" onClick={() => abrir('L' + (k + 1))}>Próximo ▸ {proxima.titulo}</button>
                  : itens.length > 0 && <button className="cer-prox" onClick={() => abrir(0)}>Próximo ▸ {itens[0].momento}</button>}
              </div>
            )}
          </div>
        );
      })}

      {itens.map((i, n) => {
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
        const falta = !i.nome ? 'Nenhuma música escolhida para este momento.' : mostraCifra ? 'A cifra desta música ainda não foi cadastrada.' : 'A letra desta música ainda não foi cadastrada.';
        let aviso = '';
        if (mostraCifra && i.cifra && i.tom && !i.tom_original) aviso = 'O tom original desta cifra não foi cadastrado, por isso ela não foi transposta automaticamente. Use os botões de meio tom se precisar.';
        else if (mostraCifra && i.cifra && i.tom && i.tom_original && auto === null) aviso = `Não foi possível transpor automaticamente (tom: “${i.tom}”). A cifra está no tom original${lerTom(i.tom_original) ? ` (${i.tom_original})` : ''}.`;
        const ativo = aberto === n;
        return (
          <div key={i.id} ref={el => { refs.current[n] = el; }} className={'card cer-mom' + (ativo ? ' cer-ativo' : '')}>
            <button type="button" className="cer-cab" onClick={() => abrir(n)} aria-expanded={ativo}>
              <span className={'cer-num' + (i.numero ? '' : ' cer-sem')}>{i.numero || '✦'}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span className="cer-momento">{i.momento}</span>
                <span className="cer-musica">{i.nome || <span className="mut">sem música escolhida</span>}{i.nome && i.artista ? <span className="mut"> · {i.artista}</span> : null}</span>
              </span>
              <span aria-hidden="true">{ativo ? '▾' : '▸'}</span>
            </button>
            <div className="chips" style={{ marginTop: 6 }}>
              {i.tom && <Selo forte>Tom: {i.tom}</Selo>}
              {mostraCifra && i.capo > 0 && <Selo forte>Capotraste na {i.capo}ª casa</Selo>}
              {i.obs && i.obs.length <= 40 && <Selo forte>{i.obs}</Selo>}
            </div>
            {i.obs && i.obs.length > 40 && <p className="cer-obs">{/^aclama/i.test(i.momento) ? <><strong>V.</strong> </> : null}{i.obs}</p>}
            {ativo && (
              <div style={{ marginTop: 12 }}>
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
                {texto ? <pre className={mostraCifra ? 'cer-cifra' : 'cer-letra'} style={{ fontSize: `${(mostraCifra ? 1 : 1.15) * fonte}rem` }}>{texto}</pre> : <p className="mut">{falta}</p>}
                {n < itens.length - 1
                  ? <button className="cer-prox" onClick={() => abrir(n + 1)}>Próximo momento ▸ {itens[n + 1].momento}</button>
                  : <p className="mut" style={{ textAlign: 'center', marginTop: 16 }}>Fim do roteiro 🎶</p>}
              </div>
            )}
          </div>
        );
      })}
      {d.obs && <div className="card"><strong>Observações</strong><p style={{ whiteSpace: 'pre-wrap', margin: '6px 0 0' }}>{d.obs}</p></div>}
      <button type="button" className="sec cer-prox" style={{ marginTop: 8 }} onClick={sair}>◂ Sair do modo celebração</button>
    </div>
  );
}
