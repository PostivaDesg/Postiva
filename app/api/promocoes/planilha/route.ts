// Modo 2: planilha com EAN, nome, preço de, preço por e validade.
// Cada EAN é identificado no Cosmos (foto, nome oficial, marca, NCM).
import { NextResponse } from 'next/server';
import { currentProfile } from '@/lib/supabase';
import { parseSheet } from '@/lib/promo-sheet';
import { fromEan, isValidEan } from '@/lib/products';

export const maxDuration = 120;

export async function POST(req: Request) {
  const me = await currentProfile();
  if (!me) return NextResponse.json({ error: 'Faça login.' }, { status: 401 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Envie a planilha.' }, { status: 400 });
  if (file.size > 2_000_000) return NextResponse.json({ error: 'Planilha muito grande (máximo 2 MB).' }, { status: 400 });

  const rows = await parseSheet(await file.arrayBuffer(), file.name);
  if (!rows.length) return NextResponse.json({ error: 'A planilha está vazia ou sem cabeçalho.' }, { status: 400 });

  // Consulta o Cosmos em grupos de 5 para não estourar o limite de consultas
  const out = [];
  for (let i = 0; i < rows.length; i += 5) {
    const chunk = await Promise.all(rows.slice(i, i + 5).map(async (r) => {
      if (r.error) return { ...r, product: null };
      if (r.ean && !isValidEan(r.ean)) return { ...r, error: 'EAN inválido (confira os dígitos).', product: null };
      if (!r.ean) return { ...r, product: null, warning: 'Sem EAN: envie a foto do produto.' };
      try {
        const product = await fromEan(r.ean);
        if (!product) return { ...r, product: null, warning: 'EAN não encontrado: envie a foto do produto.' };
        return {
          ...r,
          name: r.name || product.name, // o nome da planilha vence; senão usa o do Cosmos
          product,
          warning: !product.photoUrl ? 'Sem foto: envie a foto do produto.'
            : product.isMedicine ? 'Medicamento: confirme que é de venda livre.' : undefined,
        };
      } catch {
        return { ...r, product: null, warning: 'Não consegui consultar este EAN agora.' };
      }
    }));
    out.push(...chunk);
  }
  return NextResponse.json({ rows: out });
}
