'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { linkWhatsApp } from '@/lib/whatsapp';
import { lerTom } from '@/lib/musica';
import { dataLonga, dataCurta, TEMPOS } from '@/lib/util';
import { linkPessoal } from './musicos';

const SEM_GLORIA = ['Advento', 'Quaresma'];
// valor para <input type="datetime-local"> no horário do aparelho
const paraInput = s => { const d = new Date(s); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

// Grava a ordem atual dos itens (10, 20, 30…)
async function renumerar(itens) {
  await Promise.all(itens.map((it, i) => it.ordem === (i + 1) * 10 ? null : supabase.from('missa_itens').update({ ordem: (i + 1) * 10 }).eq('id', it.id)));
}

function NovaMissa({ anteriores, onCriada, onCancelar }) {
  const ultimo = anteriores[0];
  const [f, setF] = useState({ data_hora: '', titulo: '', local: ultimo?.local || '', tempo: 'Tempo Comum', obs: '', base: '' });
  const [msg, setMsg] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });

  async function criar() {
    setMsg('');
    if (!f.data_hora) return setMsg('Informe a data e o horário.');
    const { data: c, error } = await supabase.from('missa_celebracoes')
      .insert({ data_hora: new Date(f.data_hora).toISOString(), titulo: f.titulo.trim(), local: f.local.trim(), tempo: f.tempo, obs: f.obs.trim() })
      .select().single();
    if (error) return setMsg('Não foi possível criar: ' + error.message);
    let itens = [];
    if (f.base) {
      const { data } = await supabase.from('missa_itens').select('momento, ordem, musica_id, tom, obs').eq('celebracao_id', f.base).order('ordem');
      itens = (data || []).map(i => ({ ...i, celebracao_id: c.id }));
      const { data: esc } = await supabase.from('missa_escalas').select('musico_id, instrumento').eq('celebracao_id', f.base);
      if (esc?.length) await supabase.from('missa_escalas').insert(esc.map(e => ({ ...e, celebracao_id: c.id })));
    } else {
      const { data } = await supabase.from('missa_momentos').select('nome, ordem').eq('ativo', true).eq('padrao', true).order('ordem');
      itens = (data || []).filter(m => !(SEM_GLORIA.includes(f.tempo) && m.nome.trim().toLowerCase() === 'glória'))
        .map((m, i) => ({ celebracao_id: c.id, momento: m.nome, ordem: (i + 1) * 10 }));
    }
    if (itens.length) await supabase.from('missa_itens').insert(itens);
    onCriada(c.id);
  }

  return (
    <div className="card">
      <h2>Nova missa</h2>
      <div className="grade2">
        <div><label>Data e horário</label><input type="datetime-local" value={f.data_hora} onChange={set('data_hora')} /></div>
        <div><label>Igreja / comunidade</label><input value={f.local} onChange={set('local')} /></div>
        <div><label>Celebração (opcional)</label><input value={f.titulo} onChange={set('titulo')} placeholder="Ex.: 30º Domingo do Tempo Comum" /></div>
        <div>
          <label>Tempo litúrgico</label>
          <select value={f.tempo} onChange={set('tempo')} style={{ width: '100%' }}>{TEMPOS.map(t => <option key={t}>{t}</option>)}</select>
        </div>
      </div>
      <label>Começar com</label>
      <select value={f.base} onChange={set('base')} style={{ width: '100%' }}>
        <option value="">Os momentos automáticos (aba Momentos)</option>
        {anteriores.slice(0, 30).map(a => <option key={a.id} value={a.id}>Copiar músicas de: {dataCurta(a.data_hora)}{a.titulo ? ' · ' + a.titulo : ''}{a.local ? ' · ' + a.local : ''}</option>)}
      </select>
      {!f.base && SEM_GLORIA.includes(f.tempo) && <p className="mut" style={{ marginTop: -6 }}>No {f.tempo} o Glória não entra automaticamente (dá para acrescentar depois).</p>}
      <label>Observações</label><input value={f.obs} onChange={set('obs')} />
      {msg && <p className="err">{msg}</p>}
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button onClick={criar}>Criar missa</button>
        <button className="sec" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Item({ it, n, total, musicas, porMomento, indicadas, onMudar, onMover, onTirar, onDuplicar }) {
  const m = musicas.find(x => x.id === it.musica_id);
  const usadas = porMomento[it.momento.toLowerCase()] || {};
  // 1º as marcadas na Biblioteca para este momento; 2º as já usadas nele; depois as outras
  const doMomento = indicadas[it.momento.toLowerCase()] || new Set();
  const marcadas = musicas.filter(x => doMomento.has(x.id));
  const sugeridas = musicas.filter(x => usadas[x.id] && !doMomento.has(x.id)).sort((a, b) => usadas[b.id] - usadas[a.id]);
  const outras = musicas.filter(x => !doMomento.has(x.id) && !usadas[x.id]);
  const tomEfetivo = it.tom || m?.tom_padrao || m?.tom_original || '';
  return (
    <div className="item">
      <div className="item-cab">
        <span className="item-mom">{n + 1}. {it.momento}</span>
        <span className="row" style={{ gap: 4 }}>
          <button className="sec mini" onClick={() => onMover(-1)} disabled={n === 0} aria-label="Subir">▲</button>
          <button className="sec mini" onClick={() => onMover(1)} disabled={n === total - 1} aria-label="Descer">▼</button>
          <button className="sec mini" onClick={onDuplicar} title="Mais uma música neste momento">+1</button>
          <button className="sec mini" onClick={onTirar} aria-label="Tirar este momento">✕</button>
        </span>
      </div>
      <div className="item-campos">
        <select value={it.musica_id || ''} onChange={e => onMudar({ musica_id: e.target.value || null, tom: '' })} style={{ width: '100%' }}>
          <option value="">— escolher música —</option>
          {marcadas.length > 0 && <optgroup label={`Músicas de ${it.momento}`}>{marcadas.map(x => <option key={x.id} value={x.id}>{x.nome}{x.artista ? ' · ' + x.artista : ''}</option>)}</optgroup>}
          {sugeridas.length > 0 && <optgroup label={`Já usadas em ${it.momento}`}>{sugeridas.map(x => <option key={x.id} value={x.id}>{x.nome}{x.artista ? ' · ' + x.artista : ''}</option>)}</optgroup>}
          {outras.length > 0 && <optgroup label={marcadas.length || sugeridas.length ? 'Outras músicas' : 'Todas as músicas'}>{outras.map(x => <option key={x.id} value={x.id}>{x.nome}{x.artista ? ' · ' + x.artista : ''}</option>)}</optgroup>}
        </select>
        <input key={'t' + it.id + it.musica_id} defaultValue={it.tom} placeholder={m?.tom_padrao || m?.tom_original || 'Tom'} aria-label="Tom"
          onBlur={e => e.target.value.trim() !== it.tom && onMudar({ tom: e.target.value.trim() })} />
      </div>
      <input key={'o' + it.id} defaultValue={it.obs} placeholder="Observação (opcional)" style={{ margin: '0 0 4px' }}
        onBlur={e => e.target.value.trim() !== it.obs && onMudar({ obs: e.target.value.trim() })} />
      {m && !m.cifra.trim() && <div className="falta">Esta música ainda não tem cifra na Biblioteca.</div>}
      {m && m.cifra.trim() && !m.tom_original && tomEfetivo && <div className="falta">Sem tom original na Biblioteca: a cifra não será transposta.</div>}
      {it.tom && !lerTom(it.tom) && <div className="falta">Não entendi o tom “{it.tom}”.</div>}
    </div>
  );
}

function Detalhe({ id, musicos, musicas, porMomento, indicadas, momentos, onFechar, onMudou }) {
  const [c, setC] = useState(null);
  const [itens, setItens] = useState([]);
  const [escala, setEscala] = useState([]);
  const [msg, setMsg] = useState('');
  const [editando, setEditando] = useState(false);
  const [f, setF] = useState({});
  const [novoMom, setNovoMom] = useState('');

  const carregar = async () => {
    const [a, b, e] = await Promise.all([
      supabase.from('missa_celebracoes').select('*').eq('id', id).single(),
      supabase.from('missa_itens').select('*').eq('celebracao_id', id).order('ordem'),
      supabase.from('missa_escalas').select('*').eq('celebracao_id', id)
    ]);
    setC(a.data); setItens(b.data || []); setEscala(e.data || []);
  };
  useEffect(() => { carregar(); }, [id]);

  async function mudarItem(it, campos) {
    setItens(x => x.map(i => i.id === it.id ? { ...i, ...campos } : i));
    const { error } = await supabase.from('missa_itens').update(campos).eq('id', it.id);
    if (error) { setMsg('Não foi possível salvar: ' + error.message); carregar(); }
    onMudou();
  }
  async function mover(n, d) {
    const nova = [...itens]; [nova[n], nova[n + d]] = [nova[n + d], nova[n]];
    setItens(nova); await renumerar(nova); carregar();
  }
  async function tirar(it) {
    if (it.musica_id && !confirm(`Tirar o momento "${it.momento}" desta missa?`)) return;
    await supabase.from('missa_itens').delete().eq('id', it.id); carregar(); onMudou();
  }
  async function inserir(nome, depoisDe) {
    let pos;
    if (depoisDe !== undefined) pos = depoisDe + 1;
    else {
      // coloca na posição natural, pela ordem da lista de momentos
      const ordemDe = Object.fromEntries(momentos.map(m => [m.nome.toLowerCase(), m.ordem]));
      const alvo = ordemDe[nome.toLowerCase()];
      pos = itens.length;
      if (alvo !== undefined) { const k = itens.findIndex(i => (ordemDe[i.momento.toLowerCase()] ?? -1) > alvo); if (k >= 0) pos = k; }
    }
    const { data, error } = await supabase.from('missa_itens').insert({ celebracao_id: id, momento: nome, ordem: 0 }).select().single();
    if (error) return setMsg('Não foi possível acrescentar: ' + error.message);
    const nova = [...itens]; nova.splice(pos, 0, data);
    await renumerar(nova); carregar(); onMudou();
  }
  function acrescentar() {
    let nome = novoMom;
    if (nome === '__outro') nome = (prompt('Nome do momento:') || '').trim();
    if (!nome) return;
    setNovoMom(''); inserir(nome);
  }
  async function escalar(m, sim) {
    if (sim) await supabase.from('missa_escalas').insert({ celebracao_id: id, musico_id: m.id });
    else await supabase.from('missa_escalas').delete().eq('celebracao_id', id).eq('musico_id', m.id);
    carregar(); onMudou();
  }
  async function salvarDados() {
    setMsg('');
    if (!f.data_hora) return setMsg('Informe a data e o horário.');
    const { error } = await supabase.from('missa_celebracoes').update({ data_hora: new Date(f.data_hora).toISOString(), titulo: f.titulo.trim(), local: f.local.trim(), tempo: f.tempo, obs: f.obs.trim() }).eq('id', id);
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    setEditando(false); carregar(); onMudou();
  }
  async function excluir() {
    if (!confirm('Excluir esta missa e o roteiro dela? As músicas continuam na Biblioteca.')) return;
    await supabase.from('missa_celebracoes').delete().eq('id', id);
    onFechar(true);
  }

  if (!c) return <div className="card mut">Carregando…</div>;
  const escalados = musicos.filter(m => escala.some(e => e.musico_id === m.id));
  const semMusica = itens.filter(i => !i.musica_id).length;
  const textoZap = m => `Olá, ${m.nome.split(' ')[0]}! Missa ${dataLonga(c.data_hora)}${c.local ? ' · ' + c.local : ''}${c.titulo ? ' (' + c.titulo + ')' : ''}.\nAs músicas, letras e cifras estão no seu link:\n${linkPessoal(m.token)}`;

  return (
    <div className="card" style={{ borderLeft: '4px solid var(--ouro)' }}>
      <div className="row">
        <button className="sec mini" onClick={() => onFechar()}>◂ Voltar</button>
        <a className="botao" href={'/missa/' + id}>🎼 Modo celebração</a>
      </div>
      {!editando ? (
        <div style={{ marginTop: 12 }}>
          <div className="mut">{dataLonga(c.data_hora)}</div>
          <h1 style={{ marginTop: 2 }}>{c.titulo || 'Missa'}</h1>
          <div className="mut">{[c.local, c.tempo].filter(Boolean).join(' · ')}</div>
          {c.obs && <p style={{ margin: '6px 0 0' }}>{c.obs}</p>}
          <button className="sec mini" style={{ marginTop: 8 }} onClick={() => { setF({ ...c, data_hora: paraInput(c.data_hora) }); setEditando(true); }}>Editar dados</button>
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <div className="grade2">
            <div><label>Data e horário</label><input type="datetime-local" value={f.data_hora} onChange={e => setF({ ...f, data_hora: e.target.value })} /></div>
            <div><label>Igreja / comunidade</label><input value={f.local} onChange={e => setF({ ...f, local: e.target.value })} /></div>
            <div><label>Celebração</label><input value={f.titulo} onChange={e => setF({ ...f, titulo: e.target.value })} /></div>
            <div><label>Tempo litúrgico</label><select value={f.tempo} onChange={e => setF({ ...f, tempo: e.target.value })} style={{ width: '100%' }}>{[...new Set([...TEMPOS, f.tempo].filter(Boolean))].map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <label>Observações</label><input value={f.obs} onChange={e => setF({ ...f, obs: e.target.value })} />
          <div className="row" style={{ justifyContent: 'flex-start' }}><button onClick={salvarDados}>Salvar</button><button className="sec" onClick={() => setEditando(false)}>Cancelar</button></div>
        </div>
      )}

      <h2 style={{ marginTop: 20 }}>Músicas {semMusica > 0 && <span className="falta" style={{ fontFamily: 'inherit', fontSize: '.85rem' }}>· {semMusica} sem música</span>}</h2>
      {musicas.length === 0 && <p className="mut">A Biblioteca ainda está vazia: cadastre as músicas na aba Biblioteca para escolher aqui.</p>}
      <div>
        {itens.map((it, n) => (
          <Item key={it.id} it={it} n={n} total={itens.length} musicas={musicas} porMomento={porMomento} indicadas={indicadas}
            onMudar={campos => mudarItem(it, campos)} onMover={d => mover(n, d)} onTirar={() => tirar(it)} onDuplicar={() => inserir(it.momento, n)} />
        ))}
      </div>
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
        <select value={novoMom} onChange={e => setNovoMom(e.target.value)} style={{ margin: 0 }}>
          <option value="">Acrescentar momento…</option>
          {momentos.filter(m => m.ativo).map(m => <option key={m.id} value={m.nome}>{m.nome}</option>)}
          <option value="__outro">Outro (digitar)</option>
        </select>
        <button className="sec" onClick={acrescentar} disabled={!novoMom}>Acrescentar</button>
      </div>

      <h2 style={{ marginTop: 20 }}>Músicos</h2>
      {musicos.filter(m => m.ativo).length === 0 ? <p className="mut">Só você. Para tocar com outros músicos, cadastre-os na aba Músicos.</p> : (
        <div className="chips">
          {musicos.filter(m => m.ativo || escala.some(e => e.musico_id === m.id)).map(m => {
            const sim = escala.some(e => e.musico_id === m.id);
            return <button key={m.id} className={'chip' + (sim ? ' on' : '')} onClick={() => escalar(m, !sim)}>{sim ? '✓ ' : ''}{m.nome}{m.instrumento ? ' · ' + m.instrumento : ''}</button>;
          })}
        </div>
      )}
      {escalados.length > 0 && (
        <div className="chips" style={{ marginTop: 10 }}>
          {escalados.map(m => m.telefone
            ? <a key={m.id} className="chip" style={{ textDecoration: 'none' }} href={linkWhatsApp(m.telefone, textoZap(m))} target="_blank" rel="noreferrer">Avisar {m.nome.split(' ')[0]} pelo WhatsApp</a>
            : <span key={m.id} className="chip mut">{m.nome}: sem WhatsApp cadastrado</span>)}
        </div>
      )}
      {msg && <p className="err">{msg}</p>}
      <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
        <button className="sec" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={excluir}>Excluir missa</button>
      </div>
    </div>
  );
}

export default function Missas() {
  const [lista, setLista] = useState(null);
  const [resumo, setResumo] = useState({});
  const [musicos, setMusicos] = useState([]);
  const [musicas, setMusicas] = useState([]);
  const [momentos, setMomentos] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [ligacoes, setLigacoes] = useState([]);
  const [nova, setNova] = useState(false);
  const [aberta, setAberta] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);

  const carregar = async () => {
    const [a, b, d, e, g, h] = await Promise.all([
      supabase.from('missa_celebracoes').select('*').order('data_hora'),
      supabase.from('missa_itens').select('celebracao_id, momento, musica_id'),
      supabase.from('missa_musicos').select('*').order('nome'),
      supabase.from('missa_musicas').select('id, nome, artista, cifra, tom_original, tom_padrao').order('nome'),
      supabase.from('missa_momentos').select('*').order('ordem'),
      supabase.from('missa_musicas_momentos').select('*')
    ]);
    setLigacoes(h.data || []);
    setLista(a.data || []);
    const r = {};
    (b.data || []).forEach(i => { const x = (r[i.celebracao_id] ||= { total: 0, faltam: 0 }); x.total++; if (!i.musica_id) x.faltam++; });
    setResumo(r); setHistorico(b.data || []);
    setMusicos(d.data || []); setMusicas(e.data || []); setMomentos(g.data || []);
  };
  useEffect(() => { carregar(); }, []);

  // Quantas vezes cada música já foi usada em cada momento (para sugerir primeiro)
  const porMomento = useMemo(() => {
    const p = {};
    historico.forEach(i => { if (!i.musica_id) return; const k = i.momento.toLowerCase(); (p[k] ||= {}); p[k][i.musica_id] = (p[k][i.musica_id] || 0) + 1; });
    return p;
  }, [historico]);

  // Músicas marcadas na Biblioteca para cada momento (pelo nome do momento)
  const indicadas = useMemo(() => {
    const nomeDe = Object.fromEntries(momentos.map(m => [m.id, m.nome.toLowerCase()]));
    const r = {};
    ligacoes.forEach(l => { const k = nomeDe[l.momento_id]; if (k) (r[k] ||= new Set()).add(l.musica_id); });
    return r;
  }, [ligacoes, momentos]);

  if (lista === null) return <p className="mut">Carregando…</p>;
  if (aberta) return <Detalhe id={aberta} musicos={musicos} musicas={musicas} porMomento={porMomento} indicadas={indicadas} momentos={momentos}
    onMudou={carregar} onFechar={() => { setAberta(null); carregar(); }} />;

  const limite = Date.now() - 12 * 3600e3;
  const proximas = lista.filter(c => new Date(c.data_hora).getTime() >= limite);
  const anteriores = lista.filter(c => new Date(c.data_hora).getTime() < limite).reverse();
  const cartao = c => {
    const r = resumo[c.id] || { total: 0, faltam: 0 };
    return (
      <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setAberta(c.id)}>
        <div className="row">
          <span>
            <strong>{dataLonga(c.data_hora)}</strong>
            <div className="mut">{[c.titulo, c.local].filter(Boolean).join(' · ') || 'Missa'}</div>
          </span>
          <span className={r.faltam ? 'falta' : 'okmsg'} style={{ fontSize: '.85rem' }}>{r.total === 0 ? 'Sem momentos' : r.faltam ? `${r.faltam} de ${r.total} sem música` : '✓ Roteiro completo'}</span>
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Próximas missas</h2>
        {!nova && <button onClick={() => setNova(true)}>+ Nova missa</button>}
      </div>
      {nova && <NovaMissa anteriores={[...lista].reverse()} onCancelar={() => setNova(false)} onCriada={id => { setNova(false); carregar(); setAberta(id); }} />}
      {proximas.length === 0 && !nova && <div className="card mut">Nenhuma missa marcada. Toque em “+ Nova missa”.</div>}
      {proximas.map(cartao)}
      {anteriores.length > 0 && (
        <>
          <button className="sec" style={{ marginTop: 8 }} onClick={() => setVerAnteriores(!verAnteriores)}>{verAnteriores ? 'Esconder anteriores' : `Ver anteriores (${anteriores.length})`}</button>
          {verAnteriores && <div style={{ marginTop: 12 }}>{anteriores.map(cartao)}</div>}
        </>
      )}
    </>
  );
}
