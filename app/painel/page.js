'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { lerPref, gravarPref } from '@/lib/util';
import Missas from './missas';
import Biblioteca from './biblioteca';
import Musicos from './musicos';
import Momentos from './momentos';

const ABAS = [['missas', 'Missas'], ['biblioteca', 'Biblioteca'], ['musicos', 'Músicos'], ['momentos', 'Momentos']];

export default function Painel() {
  const r = useRouter();
  const [ok, setOk] = useState(false);
  const [aba, setAba] = useState('missas');
  const [semSessao, setSemSessao] = useState(false);

  // Se a sessão cair (por exemplo, "Sair" em outro aparelho), avisa sem perder o que está na tela.
  // Ao entrar de novo em outra aba, esta aba recebe a sessão nova sozinha.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_ev, sessao) => setSemSessao(!sessao));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    (async () => {
      const { data: admin } = await supabase.rpc('eh_admin');
      if (!admin) return r.replace('/');
      setAba(lerPref('painel:aba', 'missas')); setOk(true);
    })();
  }, [r]);

  const trocar = a => { setAba(a); gravarPref('painel:aba', a); };
  // Sai só deste aparelho (não derruba o Sonata nem outros aparelhos)
  async function sair() { await supabase.auth.signOut({ scope: 'local' }); r.replace('/'); }

  if (!ok) return <div className="wrap mut">Carregando…</div>;
  return (
    <div className="wrap">
      {semSessao && (
        <div className="card late" style={{ position: 'sticky', top: 8, zIndex: 5 }}>
          <strong>Sua sessão terminou.</strong>
          <p style={{ margin: '4px 0 8px' }}>Para salvar, entre de novo numa outra aba e depois volte aqui: o que você digitou continua nesta tela.</p>
          <a className="botao" href="/?entrar=1" target="_blank" rel="noreferrer">Entrar em outra aba</a>
        </div>
      )}
      <div className="tabs">
        {ABAS.map(([k, t]) => <button key={k} className={aba === k ? 'on' : ''} onClick={() => trocar(k)}>{t}</button>)}
        <button style={{ marginLeft: 'auto' }} onClick={sair}>Sair</button>
      </div>
      {aba === 'missas' && <Missas />}
      {aba === 'biblioteca' && <Biblioteca />}
      {aba === 'musicos' && <Musicos />}
      {aba === 'momentos' && <Momentos />}
    </div>
  );
}
