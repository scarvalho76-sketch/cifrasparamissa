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

  useEffect(() => {
    (async () => {
      const { data: admin } = await supabase.rpc('eh_admin');
      if (!admin) return r.replace('/');
      setAba(lerPref('painel:aba', 'missas')); setOk(true);
    })();
  }, [r]);

  const trocar = a => { setAba(a); gravarPref('painel:aba', a); };
  async function sair() { await supabase.auth.signOut(); r.replace('/'); }

  if (!ok) return <div className="wrap mut">Carregando…</div>;
  return (
    <div className="wrap">
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
