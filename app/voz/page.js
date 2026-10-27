'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { carregarBiblioteca } from '@/lib/biblioteca';
import { letraDaCifra, ehLinhaDeAcordes } from '@/lib/musica';
import { simples } from '@/lib/util';
import BuscaMusicas from '@/components/BuscaMusicas';

// TESTE: rolagem guiada pela voz.
// Duas pistas: (1) volume da voz, calibrado no ambiente -> desce devagar enquanto se canta;
// (2) palavras reconhecidas (reconhecimento de voz do navegador) -> reposiciona na região certa da letra.
const palavras = t => simples(t).split(' ').filter(p => p.length >= 3);

export default function TesteVoz() {
  const [biblio, setBiblio] = useState(null);
  const [musica, setMusica] = useState(null);
  const [nivel, setNivel] = useState(0);          // volume atual (0–100)
  const [calib, setCalib] = useState(null);       // { fundo, voz, limiar }
  const [etapa, setEtapa] = useState('');         // mensagens da calibração
  const [ouvindo, setOuvindo] = useState(false);
  const [cantando, setCantando] = useState(false);
  const [ouvido, setOuvido] = useState('');       // texto reconhecido
  const [atual, setAtual] = useState(0);          // linha atual
  const [eventos, setEventos] = useState([]);     // diário do teste
  const [velocidade, setVelocidade] = useState(18);
  const audio = useRef({}); const rec = useRef(null); const refs = useRef({});
  const atualRef = useRef(0); atualRef.current = atual;
  const calibRef = useRef(null); calibRef.current = calib;
  const [temReconhecimento, setTemReconhecimento] = useState(false);

  useEffect(() => {
    setTemReconhecimento(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    carregarBiblioteca().then(setBiblio); return () => parar();
  }, []);
  const [verCifra, setVerCifra] = useState(true);
  // linhas mostradas: a cifra (acordes + letra) ou só a letra.
  // A busca por palavras usa só as linhas de letra; as de acordes e [partes] ficam com "palavras" vazias.
  const linhas = useMemo(() => (!musica ? [] : (verCifra && musica.cifra ? musica.cifra : (musica.letra || letraDaCifra(musica.cifra))).split('\n')), [musica, verCifra]);
  const ehAcordeLinha = l => !!l.trim() && (ehLinhaDeAcordes(l.trim()) || /^\s*\[[^\]]+\]\s*$/.test(l));
  const linhasPal = useMemo(() => linhas.map(l => (ehAcordeLinha(l) ? [] : palavras(l))), [linhas]);
  const anotar = t => setEventos(e => [`${new Date().toLocaleTimeString('pt-BR')} ${t}`, ...e].slice(0, 12));

  // microfone e medidor de volume
  async function abrirMicrofone() {
    if (audio.current.analisador) return true;
    try {
      const fluxo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const an = ctx.createAnalyser(); an.fftSize = 1024;
      ctx.createMediaStreamSource(fluxo).connect(an);
      const buf = new Float32Array(an.fftSize);
      audio.current = { fluxo, ctx, analisador: an, buf };
      const medir = () => {
        an.getFloatTimeDomainData(buf);
        let s = 0; for (const v of buf) s += v * v;
        const db = 20 * Math.log10(Math.sqrt(s / buf.length) + 1e-8); // -90 (silêncio) … 0
        const n = Math.max(0, Math.min(100, (db + 80) * 1.25));
        audio.current.n = n; setNivel(n);
        audio.current.quadro = requestAnimationFrame(medir);
      };
      medir();
      return true;
    } catch (e) { anotar('Microfone negado ou indisponível: ' + e.message); return false; }
  }
  const media = ms => new Promise(res => { const vals = []; const t = setInterval(() => vals.push(audio.current.n || 0), 50); setTimeout(() => { clearInterval(t); vals.sort((a, b) => a - b); res(vals[Math.floor(vals.length * 0.5)] || 0); }, ms); });

  async function calibrar() {
    if (!(await abrirMicrofone())) return;
    setEtapa('1/2 · Fique em silêncio (barulho do ambiente)…'); const fundo = await media(3000);
    setEtapa('2/2 · Agora cante um trecho, no volume normal…'); const voz = await media(3500);
    const limiar = fundo + Math.max(6, (voz - fundo) * 0.45);
    setCalib({ fundo: Math.round(fundo), voz: Math.round(voz), limiar: Math.round(limiar) });
    setEtapa(voz - fundo < 8 ? '⚠ Pouca diferença entre o ambiente e a voz: aproxime o aparelho ou calibre de novo.' : '✓ Calibrado.');
    anotar(`Calibração: ambiente ${Math.round(fundo)} · voz ${Math.round(voz)} · limiar ${Math.round(limiar)}`);
  }

  // procura a linha que mais combina com as últimas palavras ouvidas (perto da posição atual)
  function localizar(texto) {
    const ouvidas = palavras(texto).slice(-8);
    if (ouvidas.length < 2) return;
    let melhor = -1, nota = 0;
    const de = Math.max(0, atualRef.current - 2), ate = Math.min(linhas.length - 1, atualRef.current + 12);
    for (let i = de; i <= ate; i++) {
      const alvo = new Set([...linhasPal[i], ...(linhasPal[i + 1] || [])]);
      let n = 0; for (const p of ouvidas) if (alvo.has(p)) n++;
      const s = n - (i < atualRef.current ? 0.5 : 0) - Math.abs(i - atualRef.current) * 0.05;
      if (n >= 2 && s > nota) { nota = s; melhor = i; }
    }
    if (melhor >= 0 && melhor !== atualRef.current) { setAtual(melhor); anotar(`Palavras → linha ${melhor + 1}`); }
  }

  async function ouvir() {
    if (!musica) return;
    if (!(await abrirMicrofone())) return;
    setOuvindo(true); anotar('Ouvindo…');
    // pista 1: volume -> desce devagar enquanto canta
    let ultimo = performance.now(), resto = 0;
    const passo = t => {
      const dt = Math.min(0.1, (t - ultimo) / 1000); ultimo = t;
      const lim = calibRef.current?.limiar ?? 45;
      const canta = (audio.current.n || 0) > lim; setCantando(canta);
      if (canta) { resto += velRef.current * dt; const px = Math.floor(resto); if (px) { window.scrollBy(0, px); resto -= px; } }
      audio.current.rolagem = requestAnimationFrame(passo);
    };
    audio.current.rolagem = requestAnimationFrame(passo);
    // pista 2: palavras
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const r = new SR(); r.lang = 'pt-BR'; r.continuous = true; r.interimResults = true;
      r.onresult = e => { let t = ''; for (let i = e.resultIndex; i < e.results.length; i++) t += e.results[i][0].transcript + ' '; setOuvido(t.trim()); localizar(t); };
      r.onerror = e => anotar('Reconhecimento: ' + e.error);
      r.onend = () => { if (rec.current === r) { try { r.start(); } catch {} } }; // recomeça sozinho
      rec.current = r; try { r.start(); } catch (e) { anotar('Não iniciou o reconhecimento: ' + e.message); }
    } else anotar('Este navegador não tem reconhecimento de voz: só a pista do volume.');
  }
  const velRef = useRef(velocidade); velRef.current = velocidade;

  function parar() {
    const r = rec.current; rec.current = null; try { r?.stop(); } catch {}
    cancelAnimationFrame(audio.current.rolagem); setOuvindo(false); setCantando(false);
  }

  // a linha atual fica a 1/3 da tela
  useEffect(() => { const el = refs.current[atual]; if (el && ouvindo) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - window.innerHeight / 3, behavior: 'smooth' }); }, [atual]);

  return (
    <div className="wrap">
      <h1>Teste: rolagem pela voz</h1>
      <p className="mut">Página de teste. Escolha uma música, calibre no lugar onde vai cantar e toque em “Ouvir”. Cante com o instrumento como de costume e observe se a tela acompanha.</p>
      <div className="card">
        <strong>1. Música</strong>
        {musica ? <div className="row" style={{ marginTop: 6 }}><span>{musica.nome}</span><button className="sec mini" onClick={() => { parar(); setMusica(null); setAtual(0); }}>Trocar</button></div>
          : !biblio ? <p className="mut">Carregando a Biblioteca (entre no painel antes)…</p>
          : <BuscaMusicas musicas={biblio.musicas} momentos={biblio.momentos} onEscolher={m => { setMusica(m); setAtual(0); }} />}
      </div>
      <div className="card">
        <strong>2. Calibrar o ambiente</strong>
        <div className="voz-medidor"><div style={{ width: nivel + '%' }} className={cantando ? 'on' : ''} />{calib && <span style={{ left: calib.limiar + '%' }} title="limiar" />}</div>
        <div className="row" style={{ marginTop: 8 }}>
          <span className="mut" style={{ fontSize: '.85rem' }}>{etapa || 'Toque em Calibrar: 3 s de silêncio e depois cante 3 s.'}{calib ? ` (ambiente ${calib.fundo} · voz ${calib.voz} · limiar ${calib.limiar})` : ''}</span>
          <button className="sec mini" onClick={calibrar} disabled={ouvindo}>Calibrar</button>
        </div>
      </div>
      <div className="card">
        <strong>3. Ouvir</strong>
        <div className="row" style={{ marginTop: 6 }}>
          {!ouvindo ? <button onClick={ouvir} disabled={!musica}>🎤 Ouvir</button> : <button className="sec" onClick={parar}>⏹ Parar</button>}
          <span className="mut" style={{ fontSize: '.85rem' }}>Velocidade enquanto canta: {velocidade}
            <input type="range" min="5" max="60" value={velocidade} onChange={e => setVelocidade(+e.target.value)} style={{ width: 120, verticalAlign: 'middle', margin: '0 0 0 6px' }} /></span>
        </div>
        <p className="mut" style={{ fontSize: '.85rem' }}>Reconhecimento de palavras: {temReconhecimento ? 'disponível (precisa de internet)' : 'não disponível neste navegador'} · {cantando ? '🎵 voz detectada' : 'silêncio'}</p>
        {ouvido && <p style={{ fontSize: '.9rem', margin: 0 }}>Entendi: <em>{ouvido}</em></p>}
      </div>
      {musica && (
        <div className={'card voz-letra' + (verCifra ? ' voz-cifra' : '')}>
          <div className="row voz-botoes" style={{ justifyContent: 'flex-end', gap: 6, marginBottom: 8 }}>
            <button type="button" className={'mini' + (verCifra ? ' sec' : '')} onClick={() => { setVerCifra(false); setAtual(0); }}>Letra</button>
            <button type="button" className={'mini' + (verCifra ? '' : ' sec')} onClick={() => { setVerCifra(true); setAtual(0); }}>Cifra</button>
          </div>
          {linhas.map((l, i) => {
            // destaca a linha atual e, na cifra, a linha de acordes logo acima dela
            const ativa = i === atual || (verCifra && i === atual - 1 && ehAcordeLinha(l));
            return <div key={i} ref={el => { refs.current[i] = el; }} className={(ativa ? 'atual' : '') + (ehAcordeLinha(l) ? ' acordes' : '')} onClick={() => setAtual(i)}>{l || ' '}</div>;
          })}
        </div>
      )}
      {eventos.length > 0 && <div className="card mut" style={{ fontSize: '.8rem' }}>{eventos.map((e, i) => <div key={i}>{e}</div>)}</div>}
    </div>
  );
}
