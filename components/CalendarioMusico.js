'use client';
import { useEffect, useMemo, useState } from 'react';
import { fmtHora, dataLonga, lerPref, gravarPref } from '@/lib/util';

// Calendário do músico (como no Sonata): as missas em que está escalado.
// Grade do mês no computador, lista de dias no celular. Tocar na missa abre o Modo celebração.
const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const p2 = n => String(n).padStart(2, '0');
const chaveDia = d => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
const COR = { 'Tempo Comum': 'verde', Advento: 'roxo', Quaresma: 'roxo', 'Semana Santa': 'vermelho', Natal: 'branco', 'Páscoa': 'branco', 'Solenidade / Festa': 'branco' };

export default function CalendarioMusico({ missas }) {
  const agora = new Date();
  const atual = `${agora.getFullYear()}-${p2(agora.getMonth() + 1)}`;
  const [mes, setMes] = useState(atual);
  useEffect(() => { const s = lerPref('missa:musico:mes', null); if (s && /^\d{4}-\d{2}$/.test(s)) setMes(s); }, []);
  const [ano, m] = mes.split('-').map(Number);
  const mudar = d => { const x = new Date(ano, m - 1 + d, 1); const v = `${x.getFullYear()}-${p2(x.getMonth() + 1)}`; setMes(v); gravarPref('missa:musico:mes', v); };
  const hojeMes = () => { setMes(atual); gravarPref('missa:musico:mes', atual); };

  const dias = useMemo(() => { const n = new Date(ano, m, 0).getDate(); return Array.from({ length: n }, (_, k) => new Date(ano, m - 1, k + 1)); }, [ano, m]);
  const porDia = useMemo(() => {
    const r = {};
    (missas || []).forEach(x => { const d = new Date(x.data_hora); if (d.getFullYear() !== ano || d.getMonth() !== m - 1) return; (r[chaveDia(d)] ||= []).push(x); });
    Object.values(r).forEach(l => l.sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora)));
    return r;
  }, [missas, ano, m]);
  const hoje = chaveDia(agora);
  const vazios = dias[0].getDay();
  const doMes = Object.values(porDia).flat().length;
  const proxima = (missas || []).filter(x => new Date(x.data_hora) > new Date(Date.now() - 12 * 3600e3)).sort((a, b) => new Date(a.data_hora) - new Date(b.data_hora))[0];

  const Cartao = ({ x }) => (
    <a href={'/missa/' + x.id} className={'cal-missa cal-' + (COR[x.tempo] || 'verde')} style={{ textDecoration: 'none' }} title="Abrir o Modo celebração">
      <span className="cal-hora">{fmtHora(x.data_hora)}</span> <span className="cal-tit">{x.titulo || 'Missa'}</span>
      {x.local && <span className="cal-local">{x.local}</span>}
      {x.instrumento && <span className="cal-local">{x.instrumento}</span>}
    </a>
  );

  return (
    <>
      {proxima && (
        <a href={'/missa/' + proxima.id} style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card" style={{ borderLeft: '4px solid var(--ouro)' }}>
            <span className="mut" style={{ fontSize: '.85rem' }}>Próxima missa</span>
            <div><strong>{dataLonga(proxima.data_hora)}</strong></div>
            <div>{[proxima.titulo, proxima.local].filter(Boolean).join(' · ') || 'Missa'}{proxima.instrumento ? <span className="mut"> · {proxima.instrumento}</span> : null}</div>
            <div style={{ marginTop: 6, color: 'var(--ouro-escuro)' }}>🎼 Abrir modo celebração ▸</div>
          </div>
        </a>
      )}
      <div className="row" style={{ marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '1.7rem' }}>{MESES[m - 1]} {ano}</h2>
        <span className="row" style={{ gap: 6 }}>
          <button className="sec mini" onClick={() => mudar(-1)} aria-label="Mês anterior">‹</button>
          <button className="sec mini" onClick={hojeMes}>Hoje</button>
          <button className="sec mini" onClick={() => mudar(1)} aria-label="Próximo mês">›</button>
        </span>
      </div>
      <ul className="cal-legenda">
        <li><span className="cal-ponto cal-verde" />Tempo Comum</li>
        <li><span className="cal-ponto cal-roxo" />Advento / Quaresma</li>
        <li><span className="cal-ponto cal-branco" />Natal / Páscoa / Solenidade</li>
        <li><span className="cal-ponto cal-vermelho" />Semana Santa</li>
      </ul>
      {/* grade: telas largas */}
      <div className="cal-grade">
        {DIAS.map(d => <div key={d} className="cal-cab">{d}</div>)}
        {Array.from({ length: vazios }, (_, k) => <div key={'v' + k} className="cal-vazio" />)}
        {dias.map(d => {
          const k = chaveDia(d);
          return (
            <div key={k} className={'cal-dia' + (d.getDay() === 0 ? ' cal-domingo' : '')}>
              <div className="cal-num-linha"><span className={'cal-num' + (k === hoje ? ' cal-hoje' : '')}>{d.getDate()}</span></div>
              {(porDia[k] || []).map(x => <Cartao key={x.id} x={x} />)}
            </div>
          );
        })}
        {Array.from({ length: (7 - ((vazios + dias.length) % 7)) % 7 }, (_, k) => <div key={'f' + k} className="cal-vazio" />)}
      </div>
      {/* lista: celular (só os dias com missa e o dia de hoje) */}
      <ol className="cal-lista">
        {dias.filter(d => porDia[chaveDia(d)] || chaveDia(d) === hoje).map(d => {
          const k = chaveDia(d); const xs = porDia[k] || [];
          return (
            <li key={k} className={(xs.length ? 'cal-li-cheio' : '') + (k === hoje ? ' cal-li-hoje' : '')}>
              <div className="cal-li-data"><strong>{p2(d.getDate())}</strong><span>{DIAS[d.getDay()]}</span></div>
              <div className="cal-li-conteudo">{xs.length ? xs.map(x => <Cartao key={x.id} x={x} />) : <span className="mut" style={{ fontSize: '.85rem' }}>Hoje · nada marcado</span>}</div>
            </li>
          );
        })}
      </ol>
      {doMes === 0 && <p className="mut" style={{ marginTop: 10 }}>Nenhuma missa sua em {MESES[m - 1].toLowerCase()}.</p>}
    </>
  );
}
