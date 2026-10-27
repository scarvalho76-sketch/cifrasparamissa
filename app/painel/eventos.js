'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dataLonga, fmtData, fmtHora, juntarDataHora, TIPOS_EVENTO } from '@/lib/util';
import { carregarBiblioteca } from '@/lib/biblioteca';
import CampoDataHora from './campoData';
import BuscaMusicas from '@/components/BuscaMusicas';
import ConviteBotao from '@/components/ConviteBotao';

// Eventos (Adoração, Luau, Terço...): cadastro e playlist de músicas da Biblioteca

function FormEvento({ inicial, anteriores, onSalvo, onCancelar }) {
  const editando = !!inicial?.id;
  const [f, setF] = useState(() => editando
    ? { ...inicial, data: fmtData(inicial.data_hora), hora: fmtHora(inicial.data_hora) }
    : { data: inicial?.data || '', hora: '', local: anteriores?.[0]?.local || '', tipo: '', nome: '', obs: '' });
  const [msg, setMsg] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  async function salvar() {
    setMsg('');
    const quando = juntarDataHora(f.data, f.hora);
    if (!quando) return setMsg('Informe a data (dd/mm/aaaa) e a hora (hh:mm).');
    if (!f.tipo) return setMsg('Escolha o tipo de evento.');
    const dados = { data_hora: quando.toISOString(), local: f.local.trim(), tipo: f.tipo, nome: f.nome.trim(), obs: f.obs.trim() };
    const { data, error } = editando
      ? await supabase.from('missa_eventos').update(dados).eq('id', f.id).select().single()
      : await supabase.from('missa_eventos').insert(dados).select().single();
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    onSalvo(data.id);
  }
  return (
    <div className="card">
      {!editando && <h2>Novo evento</h2>}
      <div className="grade2">
        <CampoDataHora data={f.data} hora={f.hora} onData={v => setF(x => ({ ...x, data: v }))} onHora={v => setF(x => ({ ...x, hora: v }))} />
        <div><label>Igreja / comunidade</label><input value={f.local} onChange={set('local')} /></div>
        <div>
          <label>Tipo de evento</label>
          <select value={f.tipo} onChange={set('tipo')} style={{ width: '100%' }}>
            <option value="">— escolher —</option>
            {[...new Set([...TIPOS_EVENTO, f.tipo].filter(Boolean))].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div><label>Nome do evento</label><input value={f.nome} onChange={set('nome')} placeholder="Ex.: Luau da juventude" /></div>
      </div>
      <label>Observações</label><input value={f.obs} onChange={set('obs')} />
      {msg && <p className="err">{msg}</p>}
      <div className="row" style={{ justifyContent: 'flex-start' }}>
        <button onClick={salvar}>{editando ? 'Salvar' : 'Criar evento'}</button>
        <button className="sec" onClick={onCancelar}>Cancelar</button>
      </div>
    </div>
  );
}

function Detalhe({ id, biblio, onFechar, onMudou }) {
  const [ev, setEv] = useState(null);
  const [lista, setLista] = useState([]);
  const [editando, setEditando] = useState(false);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    const [a, b] = await Promise.all([
      supabase.from('missa_eventos').select('*').eq('id', id).single(),
      supabase.from('missa_evento_musicas').select('*').eq('evento_id', id).order('ordem')
    ]);
    setEv(a.data); setLista(b.data || []);
  };
  useEffect(() => { carregar(); }, [id]);
  const porId = useMemo(() => Object.fromEntries((biblio?.musicas || []).map(m => [m.id, m])), [biblio]);

  async function adicionar(m) {
    setMsg('');
    const ordem = (lista[lista.length - 1]?.ordem || 0) + 10;
    const { error } = await supabase.from('missa_evento_musicas').insert({ evento_id: id, musica_id: m.id, ordem });
    if (error) return setMsg('Não foi possível adicionar: ' + error.message);
    carregar(); onMudou();
  }
  async function tirar(it) { await supabase.from('missa_evento_musicas').delete().eq('id', it.id); carregar(); onMudou(); }
  async function mover(n, d) {
    const nova = [...lista]; [nova[n], nova[n + d]] = [nova[n + d], nova[n]]; setLista(nova);
    await Promise.all(nova.map((x, i) => x.ordem === (i + 1) * 10 ? null : supabase.from('missa_evento_musicas').update({ ordem: (i + 1) * 10 }).eq('id', x.id)));
    carregar();
  }
  async function excluir() {
    if (!confirm('Excluir este evento e a lista de músicas dele? As músicas continuam na Biblioteca.')) return;
    await supabase.from('missa_eventos').delete().eq('id', id); onFechar(true);
  }

  if (!ev) return <div className="card mut">Carregando…</div>;
  if (editando) return <FormEvento inicial={ev} onSalvo={() => { setEditando(false); carregar(); onMudou(); }} onCancelar={() => setEditando(false)} />;
  return (
    <div className="card" style={{ borderLeft: '4px solid var(--azul)' }}>
      <div className="row">
        <button className="sec mini" onClick={() => onFechar()}>◂ Voltar</button>
        <a className="botao" href={'/evento/' + id}>🎵 Modo evento</a>
      </div>
      <div style={{ marginTop: 12 }}>
        <div className="mut">{dataLonga(ev.data_hora)}</div>
        <h1 style={{ marginTop: 2 }}>{ev.nome || ev.tipo || 'Evento'}</h1>
        <div className="mut">{[ev.tipo, ev.local].filter(Boolean).join(' · ')}</div>
        {ev.obs && <p style={{ margin: '6px 0 0' }}>{ev.obs}</p>}
        <div className="row" style={{ justifyContent: 'flex-start', gap: 6, marginTop: 8 }}>
          <button className="sec mini" onClick={() => setEditando(true)}>Editar dados</button>
          <ConviteBotao evento missaId={id} dataHora={ev.data_hora} titulo={ev.nome || ev.tipo} />
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Músicas <span className="mut" style={{ fontFamily: 'inherit', fontSize: '.9rem', fontWeight: 400 }}>· {lista.length}</span></h2>
      {lista.length === 0 && <p className="mut">Nenhuma música ainda. Busque abaixo e toque em “+ Adicionar”.</p>}
      <ol className="playlist">
        {lista.map((it, n) => {
          const m = porId[it.musica_id];
          return (
            <li key={it.id} className={it.tocada ? 'tocada' : ''}>
              <span className="pos">{n + 1}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <strong>{m?.nome || 'Música removida da Biblioteca'}</strong>{m?.artista ? <span className="mut"> · {m.artista}</span> : null}
                {it.tocada && <span className="mut" style={{ fontSize: '.8rem' }}> · já tocada</span>}
              </span>
              <button className="sec mini" onClick={() => mover(n, -1)} disabled={n === 0} aria-label="Subir">▲</button>
              <button className="sec mini" onClick={() => mover(n, 1)} disabled={n === lista.length - 1} aria-label="Descer">▼</button>
              <button className="sec mini" onClick={() => tirar(it)} aria-label="Tirar da lista">✕</button>
            </li>
          );
        })}
      </ol>
      <h2 style={{ marginTop: 20 }}>Adicionar músicas</h2>
      {!biblio ? <p className="mut">Carregando a Biblioteca…</p>
        : <BuscaMusicas musicas={biblio.musicas} momentos={biblio.momentos} onEscolher={adicionar} jaTem={new Set(lista.map(x => x.musica_id))} />}
      {msg && <p className="err">{msg}</p>}
      <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
        <button className="sec" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={excluir}>Excluir evento</button>
      </div>
    </div>
  );
}

export default function Eventos({ alvo }) {
  const [lista, setLista] = useState(null);
  const [qtd, setQtd] = useState({});
  const [novo, setNovo] = useState(null); // null ou { data }
  const [aberto, setAberto] = useState(null);
  const [verAnteriores, setVerAnteriores] = useState(false);
  const [biblio, setBiblio] = useState(null);

  const carregar = async () => {
    const [a, b] = await Promise.all([
      supabase.from('missa_eventos').select('*').order('data_hora'),
      supabase.from('missa_evento_musicas').select('evento_id')
    ]);
    setLista(a.data || []);
    const q = {}; (b.data || []).forEach(x => { q[x.evento_id] = (q[x.evento_id] || 0) + 1; }); setQtd(q);
  };
  useEffect(() => { carregar(); carregarBiblioteca().then(setBiblio); }, []);
  useEffect(() => {
    if (!alvo) return;
    if (alvo.evento) { setNovo(null); setAberto(alvo.evento); }
    if (alvo.novoEvento) { setAberto(null); setNovo({ data: alvo.novoEvento }); }
  }, [alvo]);

  if (lista === null) return <p className="mut">Carregando…</p>;
  if (aberto) return <Detalhe id={aberto} biblio={biblio} onMudou={carregar} onFechar={() => { setAberto(null); carregar(); }} />;

  const limite = Date.now() - 12 * 3600e3;
  const proximos = lista.filter(e => new Date(e.data_hora).getTime() >= limite);
  const anteriores = lista.filter(e => new Date(e.data_hora).getTime() < limite).reverse();
  const cartao = e => (
    <div key={e.id} className="card" style={{ cursor: 'pointer', borderTopColor: 'var(--azul)' }} onClick={() => setAberto(e.id)}>
      <div className="row">
        <span>
          <strong>{dataLonga(e.data_hora)}</strong>
          <div className="mut">{[e.tipo, e.nome, e.local].filter(Boolean).join(' · ')}</div>
        </span>
        <span className="mut" style={{ fontSize: '.85rem' }}>{qtd[e.id] ? `${qtd[e.id]} ${qtd[e.id] === 1 ? 'música' : 'músicas'}` : 'sem músicas'}</span>
      </div>
    </div>
  );
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Próximos eventos</h2>
        {!novo && <button onClick={() => setNovo({})}>+ Novo evento</button>}
      </div>
      {novo && <FormEvento key={novo.data || 'novo'} inicial={novo} anteriores={[...lista].reverse()} onCancelar={() => setNovo(null)} onSalvo={id => { setNovo(null); carregar(); setAberto(id); }} />}
      {proximos.length === 0 && !novo && <div className="card mut">Nenhum evento marcado. Toque em “+ Novo evento”.</div>}
      {proximos.map(cartao)}
      {anteriores.length > 0 && (
        <>
          <button className="sec" style={{ marginTop: 8 }} onClick={() => setVerAnteriores(!verAnteriores)}>{verAnteriores ? 'Esconder anteriores' : `Ver anteriores (${anteriores.length})`}</button>
          {verAnteriores && <div style={{ marginTop: 12 }}>{anteriores.map(cartao)}</div>}
        </>
      )}
    </>
  );
}
