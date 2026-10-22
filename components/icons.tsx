// Ícones de linha simples (24x24, traço 1.8), sem biblioteca.
const P = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const I = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path {...P} d={d} /></svg>;
export const Icon = {
  inicio: () => <I d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  aprovar: () => <I d="M4 12.5 9 17.5 20 6.5" />,
  calendario: () => <I d="M4 6.5h16v13H4zM4 10.5h16M8 3.5v4M16 3.5v4" />,
  promocao: () => <I d="M4 10v4l11 5V5L4 10zM15 9.5a3 3 0 0 1 0 5M7 14.5l1 4.5" />,
  pedido: () => <I d="M13 3 5 14h6l-1 7 8-11h-6l1-7z" />,
  marca: () => <I d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 1.8-1 1.3-2-.6-1.2.1-2.5 1.5-2.5H17a3.5 3.5 0 0 0 3.5-3.5c0-5-3.8-9-8.5-9zM7.5 11.5h.01M10 7.5h.01M15 7.5h.01" />,
  relatorio: () => <I d="M4 20V10M10 20V4M16 20v-7M21 20H3" />,
  conta: () => <I d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5a7.5 7.5 0 0 1 15 0" />,
  fila: () => <I d="M4 6h16M4 12h16M4 18h10" />,
  empresas: () => <I d="M4 20V6.5L12 3l8 3.5V20M9 20v-5h6v5M8 9.5h.01M12 9.5h.01M16 9.5h.01" />,
  nova: () => <I d="M12 5v14M5 12h14" />,
  diagnostico: () => <I d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
};
