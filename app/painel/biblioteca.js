'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { gerarGrade, lerTom, letraDaCifra, nomeDoTom } from '@/lib/musica';
import { lerPdfDeCifra } from '@/lib/pdfCifra';
import { lerTxtDeCifra } from '@/lib/txtCifra';
import { lerVideoDoYoutube, linkDoVideo } from '@/lib/youtube';
import ConferirSalmo from '@/components/ConferirSalmo';
const ehTxt = arq => /\.txt$/i.test(arq.name) || arq.type === 'text/plain';
const lerArquivo = arq => (ehTxt(arq) ? lerTxtDeCifra(arq) : lerPdfDeCifra(arq));
import { chave, simples, dataCurta, TEMPOS_ESPECIFICOS, nomeTempo } from '@/lib/util';
import { ehConta } from '@/lib/conta';
import Paginacao, { paginar } from '@/components/Paginacao';

// Biblioteca de letras e cifras das missas: uma ficha por música (nome + artista).
// Mesma lógica do Sonata Casamentos: cifra única, letra tirada da cifra, transposição pelo tom original.
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: '.9rem', lineHeight: 1.45, whiteSpace: 'pre', overflowX: 'auto' };
const vazio = { nome: '', artista: '', tom_original: '', tom_padrao: '', capo: 0, letra: '', cifra: '', grade: '', obs: '', video: '' };

// youtube: abre já com o campo do link em destaque; momentoId: a música nova já fica marcada nesse momento
export function Editor({ ficha, inicial, onSalvo, onCancelar, existentes, youtube = false, momentoId = null, obsPadrao = '', salmo = null }) {
  const [f, setF] = useState(() => ({
    ...vazio, ...(ficha || {}), ...(!ficha && obsPadrao ? { obs: obsPadrao } : {}),
    ...(inicial ? { nome: inicial.nome || '', artista: inicial.artista || '', cifra: inicial.cifra || '', tom_original: inicial.tom || '', capo: inicial.capo || 0, tom_padrao: inicial.tomReal || '', letra: '', video: inicial.video || '' } : {})
  }));
  const [msg, setMsg] = useState(inicial && !inicial.tom ? 'Não encontrei o tom no arquivo: preencha o tom original.' : '');
  const [lendo, setLendo] = useState(false);
  const [okYt, setOkYt] = useState('');
  const set = k => e => setF({ ...f, [k]: e.target.value });
  const tomInvalido = t => t.trim() && !lerTom(t);

  async function importar(e) {
    const arq = e.target.files?.[0]; e.target.value = '';
    if (!arq) return;
    const tipo = ehTxt(arq) ? 'arquivo' : 'PDF';
    if (f.cifra.trim() && !confirm(`Substituir a cifra atual pela do ${tipo}?`)) return;
    setMsg(''); setLendo(tipo);
    try {
      const r = await lerArquivo(arq);
      setF({ ...f, nome: f.nome || r.nome || '', artista: f.artista || r.artista || '', cifra: r.cifra, letra: '', tom_original: r.tom || f.tom_original, ...(r.capo ? { capo: r.capo, tom_padrao: f.tom_padrao || r.tomReal || '' } : {}) });
      setMsg(r.tom ? '' : `${tipo === 'PDF' ? 'PDF lido' : 'Arquivo lido'}. Não encontrei o tom no arquivo: preencha o tom original.`);
    } catch (err) { setMsg(`Não foi possível ler o ${tipo}: ` + err.message); }
    setLendo(false);
  }

  // Lê a descrição do vídeo e traz a cifra que estiver lá (para revisar antes de salvar)
  async function buscarNoYoutube() {
    setMsg(''); setOkYt('');
    if (!f.video.trim()) {
      // no Salmo da missa, sem link: abre a busca do YouTube pelo salmo do dia
      if (salmo) {
        const num = (String(salmo.referencia || '').match(/\d+/) || [''])[0];
        const busca = [num ? 'Salmo ' + num : 'Salmo', salmo.refrao || ''].join(' ').replace(/[!?.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
        window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(busca), '_blank', 'noopener');
        return setOkYt('Abri o YouTube com a busca pelo salmo do dia. Escolha o vídeo, copie o link e cole aqui.');
      }
      return setMsg('Cole o link do vídeo do YouTube.');
    }
    setLendo('youtube');
    try {
      const r = await lerVideoDoYoutube(f.video);
      const novo = { ...f, video: r.video, nome: f.nome || r.nome, artista: f.artista || r.artista };
      if (r.achou) {
        if (!f.cifra.trim() || confirm('Substituir a cifra atual pela da descrição do vídeo?')) {
          Object.assign(novo, { cifra: r.cifra, letra: '', tom_original: r.tom || f.tom_original, ...(r.capo ? { capo: r.capo } : {}) });
          setOkYt('✓ Cifra trazida da descrição do vídeo. Confira se os acordes estão em cima das sílabas certas.' + (r.tom ? '' : ' Não encontrei o tom: preencha o tom original.'));
        }
      } else {
        if (!f.cifra.trim() && r.descricao.trim()) novo.cifra = r.descricao.trim();
        setMsg(r.descricao.trim() ? 'Não encontrei acordes na descrição do vídeo.' + (!f.cifra.trim() ? ' Coloquei a descrição inteira na caixa da cifra: aproveite o que servir.' : '') : 'Este vídeo não tem descrição.');
      }
      setF(novo);
    } catch (err) { setMsg(err.message); }
    setLendo(false);
  }

  async function salvar() {
    setMsg('');
    if (!f.nome.trim()) return setMsg('Informe o nome da música.');
    const k = chave(f.nome, f.artista);
    const outra = existentes?.[k];
    if (outra && outra.id !== f.id && !confirm('Já existe uma ficha com este nome e artista. Substituir pelo que está aqui?')) return;
    const dados = {
      nome: f.nome.trim(), artista: f.artista.trim(), tom_original: f.tom_original.trim(), tom_padrao: f.tom_padrao.trim(), capo: Number(f.capo) || 0,
      letra: f.letra.replace(/\s+$/, ''), cifra: f.cifra.replace(/\s+$/, ''), grade: f.grade.replace(/\s+$/, ''), obs: f.obs.trim(),
      video: linkDoVideo(f.video) || f.video.trim(),
      atualizado_em: new Date().toISOString()
    };
    const alvo = f.id || outra?.id;
    const { data: gravada, error } = alvo
      ? await supabase.from('missa_musicas').update(dados).eq('id', alvo).select('id').single()
      : await supabase.from('missa_musicas').insert(dados).select('id').single();
    if (error) return setMsg('Não foi possível salvar: ' + error.message);
    const id = gravada?.id || alvo;
    if (momentoId && id) await supabase.from('missa_musicas_momentos').upsert({ musica_id: id, momento_id: momentoId }, { onConflict: 'musica_id,momento_id', ignoreDuplicates: true });
    onSalvo(id);
  }

  async function excluir() {
    if (!confirm(`Excluir "${f.nome}" da Biblioteca? Nas missas em que ela foi escolhida, o momento fica sem música.`)) return;
    const { error } = await supabase.from('missa_musicas').delete().eq('id', f.id);
    if (error) return setMsg('Não foi possível excluir: ' + error.message);
    onSalvo();
  }

  const linhaYoutube = (
    <div style={{ marginBottom: 12, ...(youtube ? { padding: 10, border: '1px solid var(--ouro)', borderRadius: 4, background: 'var(--fundo)' } : {}) }}>
      <label style={{ marginTop: 0 }}>Vídeo no YouTube (opcional): a cifra pode vir da descrição</label>
      <div className="row" style={{ gap: 6, flexWrap: 'nowrap' }}>
        <input value={f.video} onChange={set('video')} placeholder="Cole aqui o link do vídeo" inputMode="url" autoFocus={youtube} style={{ margin: 0, flex: 1, minWidth: 0 }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscarNoYoutube(); } }} />
        <button type="button" className="sec" onClick={buscarNoYoutube} disabled={lendo === 'youtube'} style={{ whiteSpace: 'nowrap' }}>{lendo === 'youtube' ? 'Lendo…' : salmo && !f.video.trim() ? '▶ Procurar no YouTube' : '▶ Buscar cifra'}</button>
      </div>
      {okYt && <p className="okmsg" style={{ margin: '6px 0 0' }}>{okYt}</p>}
    </div>
  );

  return (
    <div style={{ marginTop: 10 }}>
      {youtube && linhaYoutube}
      <div className="grade2">
        <div><label>Nome da música</label><input value={f.nome} onChange={set('nome')} /></div>
        <div><label>Cantor / autor (opcional)</label><input value={f.artista} onChange={set('artista')} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-start', gap: 8, marginBottom: 12 }}>
        <label style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid var(--ouro)', borderRadius: 3, padding: '6px 12px', color: 'var(--ouro-escuro)', margin: 0 }}>
          {lendo === 'PDF' ? 'Lendo o PDF…' : '📄 Importar cifra de um PDF'}
          <input type="file" accept="application/pdf" onChange={importar} style={{ display: 'none' }} />
        </label>
        <label style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid var(--ouro)', borderRadius: 3, padding: '6px 12px', color: 'var(--ouro-escuro)', margin: 0 }}>
          {lendo === 'arquivo' ? 'Lendo o arquivo…' : '📝 Importar de um arquivo de texto'}
          <input type="file" accept=".txt,text/plain" onChange={importar} style={{ display: 'none' }} />
        </label>
      </div>
      {!youtube && linhaYoutube}
      <label>Cifra: acordes em cima da letra, como no Cifra Club</label>
      <textarea rows={14} value={f.cifra} onChange={set('cifra')} placeholder="Cole aqui a cifra" style={mono} spellCheck={false} />
      {salmo && f.cifra.trim() && <div style={{ margin: '-4px 0 12px' }}><ConferirSalmo cifra={f.cifra} letra={f.letra} salmo={salmo} aberto /></div>}
      <div className="grade2">
        <div>
          <label>Tom em que a cifra foi escrita</label>
          <input value={f.tom_original} onChange={set('tom_original')} placeholder="Ex.: G, Dm, Bb" />
          {tomInvalido(f.tom_original) && <p className="err" style={{ marginTop: -8 }}>Não entendi este tom. Use, por exemplo: C, Am, F#, Bb, Ré, Lá menor.</p>}
        </div>
        <div>
          <label>Tom em que eu canto (vale para todas as missas)</label>
          <input value={f.tom_padrao} onChange={set('tom_padrao')} placeholder="Vazio = tom original" />
          {tomInvalido(f.tom_padrao) && <p className="err" style={{ marginTop: -8 }}>Não entendi este tom.</p>}
        </div>
      </div>
      <label>Capotraste no violão (quando necessário)</label>
      <div className="row" style={{ justifyContent: 'flex-start', marginBottom: 4 }}>
        <select value={f.capo || 0} onChange={e => setF({ ...f, capo: Number(e.target.value) })} style={{ margin: 0 }}>
          <option value={0}>Sem capotraste</option>
          {Array.from({ length: 9 }, (_, k) => k + 1).map(k => <option key={k} value={k}>{k}ª casa</option>)}
        </select>
        {f.capo > 0 && lerTom(f.tom_padrao || f.tom_original) && <span className="mut" style={{ fontSize: '.9rem' }}>
          Tocando em {f.tom_padrao || f.tom_original}, o violão faz as formas de <strong>{nomeDoTom(f.tom_padrao || f.tom_original, -f.capo)}</strong>.</span>}
      </div>
      <p className="mut" style={{ fontSize: '.85rem', margin: '0 0 12px' }}>No Modo celebração, quem toca violão vê os acordes já nas formas para o capotraste; quem toca teclado vê no tom real.</p>
      <details style={{ margin: '0 0 12px' }} open={!!f.letra}>
        <summary className="mut" style={{ fontSize: '.9rem' }}>Letra para quem só canta: {f.letra.trim() ? 'personalizada' : 'tirada automaticamente da cifra'}</summary>
        <p className="mut" style={{ fontSize: '.85rem', margin: '6px 0' }}>Deixe vazio para usar a letra da própria cifra, sem os acordes.</p>
        <textarea rows={8} value={f.letra} onChange={set('letra')} placeholder={letraDaCifra(f.cifra) || 'Cole aqui a letra'} style={{ whiteSpace: 'pre-wrap' }} />
      </details>
      <div className="row" style={{ marginTop: 4 }}>
        <label style={{ margin: 0 }}>Grade harmônica: um compasso entre cada | (opcional)</label>
        <button type="button" className="sec mini" disabled={!f.cifra.trim()}
          onClick={() => { if (f.grade.trim() && !confirm('Substituir a grade atual pela gerada a partir da cifra?')) return; setF({ ...f, grade: gerarGrade(f.cifra) }); }}>
          Gerar grade a partir da cifra
        </button>
      </div>
      <textarea rows={6} value={f.grade} onChange={set('grade')} placeholder={'[Refrão]\n| G | D/F# | Em | C |'} style={mono} spellCheck={false} />
      <label>Observações (ex.: “boa para Comunhão”, “refrão 2x no final”)</label>
      <input value={f.obs} onChange={set('obs')} />
      {msg && <p className="err" style={{ whiteSpace: 'pre-line' }}>{msg}</p>}
      <div className="row">
        <span className="row" style={{ justifyContent: 'flex-start' }}>
          <button onClick={salvar}>Salvar</button>
          <button className="sec" onClick={onCancelar}>Cancelar</button>
        </span>
        {f.id && !ehConta() && <button className="sec" style={{ color: 'var(--bad)', borderColor: 'var(--bad)' }} onClick={excluir}>Excluir</button>}
      </div>
    </div>
  );
}

export default function Biblioteca() {
  const [fichas, setFichas] = useState([]);
  const [usos, setUsos] = useState({});      // musica_id -> próximas missas
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(null);
  const [filtro, setFiltro] = useState('todas');
  const [importados, setImportados] = useState([]);
  const [lendo, setLendo] = useState(false);
  const [aviso, setAviso] = useState('');
  const [momentos, setMomentos] = useState([]);
  const [liga, setLiga] = useState(new Set()); // "musica_id:momento_id"
  const [momFiltro, setMomFiltro] = useState('');
  const [tempoFiltro, setTempoFiltro] = useState('');
  const leitura = ehConta(); // amigos só consultam a Biblioteca
  const [pagina, setPagina] = useState(0);
  useEffect(() => { setPagina(0); }, [filtro, busca, momFiltro, tempoFiltro]);

  const carregar = async () => {
    const agora = new Date(Date.now() - 12 * 3600e3).toISOString();
    const [a, b, m, l] = await Promise.all([
      supabase.from('missa_musicas').select('*').order('nome'),
      supabase.from('missa_itens').select('musica_id, momento, missa_celebracoes!inner(id, data_hora, titulo)').not('musica_id', 'is', null).gte('missa_celebracoes.data_hora', agora),
      supabase.from('missa_momentos').select('id, nome, ordem').eq('ativo', true).order('ordem'),
      supabase.from('missa_musicas_momentos').select('*')
    ]);
    setMomentos(m.data || []);
    setLiga(new Set((l.data || []).map(x => x.musica_id + ':' + x.momento_id)));
    setFichas(a.data || []);
    const u = {};
    (b.data || []).forEach(x => { (u[x.musica_id] ||= []).push({ momento: x.momento, ...x.missa_celebracoes }); });
    setUsos(u);
  };
  useEffect(() => { carregar(); }, []);

  const existentes = useMemo(() => Object.fromEntries(fichas.map(x => [chave(x.nome, x.artista), x])), [fichas]);

  async function importarVarios(e) {
    const arqs = [...(e.target.files || [])]; e.target.value = '';
    if (!arqs.length) return;
    setLendo(true);
    const novos = [];
    for (const arq of arqs) {
      const id = arq.name + Date.now() + Math.random();
      try { novos.push({ id, arquivo: arq.name, dados: await lerArquivo(arq) }); }
      catch (err) { novos.push({ id, arquivo: arq.name, erro: err.message }); }
    }
    setImportados(x => [...x, ...novos]); setLendo(false);
  }
  const tirar = id => setImportados(x => x.filter(i => i.id !== id));

  // Tempos litúrgicos da música (vazio = todos os tempos); grava na hora
  async function mudarTempos(x, tempos) {
    setFichas(fs => fs.map(f => f.id === x.id ? { ...f, tempos } : f));
    const { error } = await supabase.from('missa_musicas').update({ tempos }).eq('id', x.id);
    if (error) { alert('Não foi possível salvar o tempo: ' + error.message); carregar(); }
  }

  // Marca ou desmarca o momento da música (grava na hora, como no Sonata)
  async function alternar(mid, moid) {
    const k = mid + ':' + moid; const tem = liga.has(k);
    const nova = new Set(liga); tem ? nova.delete(k) : nova.add(k); setLiga(nova);
    const { error } = tem
      ? await supabase.from('missa_musicas_momentos').delete().match({ musica_id: mid, momento_id: moid })
      : await supabase.from('missa_musicas_momentos').insert({ musica_id: mid, momento_id: moid });
    if (error) { setAviso(''); alert('Não foi possível salvar o momento: ' + error.message); carregar(); }
  }

  const t = simples(busca);
  const faltam = fichas.filter(x => usos[x.id] && !x.cifra.trim());
  const vis = fichas.filter(x => {
    if (t && !simples(x.nome + ' ' + x.artista).includes(t)) return false;
    if (tempoFiltro === 'todos' && x.tempos?.length) return false;
    if (tempoFiltro && tempoFiltro !== 'todos' && !(x.tempos || []).includes(tempoFiltro)) return false;
    if (momFiltro === 'nenhum' && momentos.some(m => liga.has(x.id + ':' + m.id))) return false;
    if (momFiltro && momFiltro !== 'nenhum' && !liga.has(x.id + ':' + momFiltro)) return false;
    if (filtro === 'faltando') return !x.cifra.trim() || !x.tom_original.trim();
    if (filtro === 'proximas') return !!usos[x.id];
    return true;
  });
  const folha = paginar(vis, pagina); // 25 músicas por página
  const filtrando = filtro !== 'todas' || busca.trim() || momFiltro || tempoFiltro;
  const selo = (ok, txt) => <span className={'chip' + (ok ? ' on' : '')} style={{ cursor: 'default' }}>{ok ? '✓' : '✗'} {txt}</span>;

  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Biblioteca <span className="mut" style={{ fontWeight: 400 }}>· {fichas.length} {fichas.length === 1 ? 'música' : 'músicas'}</span></h2>
        {!leitura && <span className="row" style={{ gap: 6 }}>
          <label style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid var(--ouro)', borderRadius: 3, padding: '8px 14px', color: 'var(--ouro-escuro)', margin: 0, fontSize: '1rem' }}>
            {lendo ? 'Lendo…' : '📄 Importar PDFs'}
            <input type="file" accept="application/pdf" multiple onChange={importarVarios} style={{ display: 'none' }} />
          </label>
          <label style={{ display: 'inline-block', cursor: 'pointer', border: '1px solid var(--ouro)', borderRadius: 3, padding: '8px 14px', color: 'var(--ouro-escuro)', margin: 0, fontSize: '1rem' }}>
            {lendo ? 'Lendo…' : '📝 Importar textos'}
            <input type="file" accept=".txt,text/plain" multiple onChange={importarVarios} style={{ display: 'none' }} />
          </label>
          <button className="sec" onClick={() => setAberto(aberto === 'youtube' ? null : 'youtube')}>{aberto === 'youtube' ? 'Fechar' : '▶ Do YouTube'}</button>
          <button className="sec" onClick={() => setAberto(aberto === 'novo' ? null : 'novo')}>{aberto === 'novo' ? 'Fechar' : '+ Música'}</button>
        </span>}
      </div>
      {aviso && <p className="okmsg">{aviso}</p>}
      {faltam.length > 0 && <div className="card late"><strong>Faltando cifra em músicas das próximas missas:</strong> {faltam.map(x => x.nome).join(', ')}</div>}
      {importados.length > 0 && <p className="mut">Revise cada música importada e toque em Salvar.</p>}
      {importados.map(i => (
        <div key={i.id} className="card" style={{ borderLeft: '4px solid var(--ouro)' }}>
          <div className="row"><strong>{/\.txt$/i.test(i.arquivo) ? '📝' : '📄'} {i.arquivo}</strong><button className="sec mini" onClick={() => tirar(i.id)}>Descartar</button></div>
          {i.erro ? <p className="err">{i.erro}</p> : <Editor inicial={i.dados} existentes={existentes} onSalvo={() => { tirar(i.id); carregar(); }} onCancelar={() => tirar(i.id)} />}
        </div>
      ))}
      {aberto === 'novo' && <div className="card"><Editor existentes={existentes} onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => setAberto(null)} /></div>}
      {aberto === 'youtube' && <div className="card" style={{ borderLeft: '4px solid var(--ouro)' }}><strong>▶ Música a partir de um vídeo do YouTube</strong>
        <Editor youtube existentes={existentes} onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => setAberto(null)} /></div>}
      <div className="tabs" style={{ marginTop: 0 }}>
        <button className={filtro === 'todas' ? 'on' : ''} onClick={() => setFiltro('todas')}>Todas</button>
        <button className={filtro === 'proximas' ? 'on' : ''} onClick={() => setFiltro('proximas')}>Nas próximas missas</button>
        <button className={filtro === 'faltando' ? 'on' : ''} onClick={() => setFiltro('faltando')}>Sem cifra ou sem tom</button>
      </div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <input placeholder="Buscar por música ou autor" value={busca} onChange={e => setBusca(e.target.value)} style={{ flex: '1 1 200px' }} />
        <select value={momFiltro} onChange={e => setMomFiltro(e.target.value)} style={{ flex: '0 1 220px' }}>
          <option value="">Todos os momentos</option>
          {momentos.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
          <option value="nenhum">Sem momento marcado</option>
        </select>
        <select value={tempoFiltro} onChange={e => setTempoFiltro(e.target.value)} style={{ flex: '0 1 220px' }}>
          <option value="">Qualquer tempo</option>
          <option value="todos">Só de todos os tempos</option>
          {TEMPOS_ESPECIFICOS.map(t => <option key={t} value={t}>Só {nomeTempo(t)}</option>)}
        </select>
      </div>
      <div id="bib-lista" />
      {fichas.length > 0 && <p className="mut" style={{ fontSize: '.9rem', margin: '0 0 10px' }}>
        <strong>{fichas.length}</strong> {fichas.length === 1 ? 'música cadastrada' : 'músicas cadastradas'}
        {filtrando ? <> · mostrando <strong>{vis.length}</strong> com este filtro</> : null}
        {folha.paginas > 1 ? ` · página ${folha.pag + 1} de ${folha.paginas}` : ''}
      </p>}
      {vis.length === 0 && <div className="card mut">{fichas.length ? 'Nenhuma música encontrada.' : (leitura ? 'A Biblioteca ainda está vazia.' : 'A Biblioteca está vazia. Importe PDFs do Cifra Club, arquivos de texto ou cadastre uma música.')}</div>}
      {folha.itens.map(x => (
        <div key={x.id} className="card">
          <div className="row">
            <span><strong>{x.nome}</strong>{x.artista ? <span className="mut"> · {x.artista}</span> : null}</span>
            <button className="sec mini" onClick={() => setAberto(aberto === x.id ? null : x.id)}>{aberto === x.id ? 'Fechar' : leitura ? 'Ver cifra' : 'Editar'}</button>
          </div>
          <div className="chips">
            {selo(!!x.cifra.trim(), 'Cifra')}{x.grade && selo(true, 'Grade')}
            {x.tom_original ? <span className="chip" style={{ cursor: 'default' }}>Tom original: {x.tom_original}</span> : selo(false, 'Tom original')}
            {x.tom_padrao && <span className="chip on" style={{ cursor: 'default' }}>Eu canto em: {x.tom_padrao}</span>}
            {x.capo > 0 && <span className="chip on" style={{ cursor: 'default' }}>Capo {x.capo}ª casa</span>}
          </div>
          <div className="chips" aria-label="Momentos desta música" style={{ alignItems: 'center', borderTop: '1px dashed var(--line)', paddingTop: 8 }}>
            <span className="mut" style={{ fontSize: '.85rem', marginRight: 2 }}>Momentos:</span>
            {leitura
              ? (momentos.filter(m => liga.has(x.id + ':' + m.id)).map(m => <span key={m.id} className="chip on" style={{ cursor: 'default' }}>{m.nome}</span>)
                  .concat(momentos.some(m => liga.has(x.id + ':' + m.id)) ? [] : [<span key="0" className="mut" style={{ fontSize: '.85rem' }}>nenhum</span>]))
              : momentos.map(m => {
                const on = liga.has(x.id + ':' + m.id);
                return <button key={m.id} className={'chip' + (on ? ' on' : '')} onClick={() => alternar(x.id, m.id)}>{on ? '✓ ' : ''}{m.nome}</button>;
              })}
          </div>
          <div className="chips" aria-label="Tempos litúrgicos desta música" style={{ alignItems: 'center' }}>
            <span className="mut" style={{ fontSize: '.85rem', marginRight: 2 }}>Tempos:</span>
            {leitura
              ? <span className={'chip' + (x.tempos?.length ? ' on' : '')} style={{ cursor: 'default' }}>{x.tempos?.length ? x.tempos.map(nomeTempo).join(', ') : 'Todos os tempos'}</span>
              : <>
                <button className={'chip' + (x.tempos?.length ? '' : ' on')} onClick={() => mudarTempos(x, [])}>{x.tempos?.length ? '' : '✓ '}Todos</button>
                {TEMPOS_ESPECIFICOS.map(t => {
                  const on = (x.tempos || []).includes(t);
                  return <button key={t} className={'chip' + (on ? ' on' : '')} onClick={() => mudarTempos(x, on ? x.tempos.filter(y => y !== t) : [...(x.tempos || []), t])}>{on ? '✓ ' : ''}{nomeTempo(t)}</button>;
                })}
              </>}
          </div>
          {x.obs && <div className="mut" style={{ fontSize: '.85rem', marginTop: 6 }}>{x.obs}</div>}
          {usos[x.id] && <div className="mut" style={{ fontSize: '.85rem', marginTop: 6 }}>Em: {usos[x.id].map(u => `${u.momento} (${dataCurta(u.data_hora)})`).join(', ')}</div>}
          {aberto === x.id && leitura && (x.cifra.trim()
            ? <pre style={{ ...mono, marginTop: 10, padding: 12, border: '1px solid var(--line)', borderRadius: 3, background: 'var(--fundo)' }}>{x.cifra}</pre>
            : <p className="mut">Esta música ainda não tem cifra.</p>)}
          {aberto === x.id && !leitura && <Editor ficha={x} existentes={existentes} onSalvo={() => { setAberto(null); carregar(); }} onCancelar={() => setAberto(null)} />}
        </div>
      ))}
      <Paginacao pag={folha.pag} paginas={folha.paginas} onMudar={setPagina} rolarPara="bib-lista" />
    </>
  );
}
