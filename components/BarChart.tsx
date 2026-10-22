// Barras de uma série (ex.: cliques por dia). Sem legenda (o título do painel nomeia a série);
// cada barra tem dica com o valor ao passar o mouse; a tabela fica no <details> para leitores de tela.
export default function BarChart({ data, label, height = 160 }: { data: { x: string; y: number }[]; label: string; height?: number }) {
  const W = 720, H = height, padL = 28, padB = 22, padT = 8;
  const max = Math.max(1, ...data.map((d) => d.y));
  const nice = max <= 4 ? 4 : Math.ceil(max / 4) * 4;
  const bw = (W - padL) / Math.max(1, data.length);
  const yOf = (v: number) => padT + (H - padT - padB) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return (
    <figure className="grafico" style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W} y1={yOf(t)} y2={yOf(t)} />
            <text className="eixo" x={padL - 6} y={yOf(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = padL + i * bw;
          const h = Math.max(0, H - padB - yOf(d.y));
          return (
            <g key={d.x}>
              <title>{`${d.x}: ${d.y}`}</title>
              <rect className="alvo" x={x} y={padT} width={bw} height={H - padT - padB} />
              {d.y > 0 && <rect className="barra" x={x + bw * 0.18} y={yOf(d.y)} width={Math.max(2, bw * 0.64)} height={h} rx={Math.min(4, bw * 0.3)} />}
              {(i === 0 || i === data.length - 1 || i % 7 === 0) && <text className="eixo" x={x + bw / 2} y={H - 6} textAnchor="middle">{d.x}</text>}
            </g>
          );
        })}
      </svg>
      <details className="muted" style={{ fontSize: 13, marginTop: 6 }}>
        <summary>Ver em tabela</summary>
        <table className="tabela"><tbody>{data.filter((d) => d.y).map((d) => <tr key={d.x}><td>{d.x}</td><td className="num">{d.y}</td></tr>)}</tbody></table>
      </details>
    </figure>
  );
}
