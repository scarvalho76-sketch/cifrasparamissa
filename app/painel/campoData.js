'use client';
import { mascaraData, mascaraHora } from '@/lib/util';

// Data (dd/mm/aaaa) e hora (24 horas), digitadas, iguais em qualquer celular ou computador
export default function CampoDataHora({ data, hora, onData, onHora }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
      <div><label>Data</label><input value={data} onChange={e => onData(mascaraData(e.target.value))} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} /></div>
      <div><label>Hora</label><input value={hora} onChange={e => onHora(mascaraHora(e.target.value))} placeholder="hh:mm" inputMode="numeric" maxLength={5} /></div>
    </div>
  );
}
