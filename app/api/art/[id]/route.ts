// Imagem da arte de um post (PNG). Aberta pelo painel e pelo Metricool com link assinado.
import { NextResponse } from 'next/server';
import { verify } from '@/lib/art/url';
import { renderPostArt } from '@/lib/art/post-art';

export const runtime = 'nodejs';
export const maxDuration = 30; // baixar logo e foto + desenhar a arte

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(req.url);
  const v = url.searchParams.get('v') ?? '1';
  if (!verify(`${id}.${v}`, url.searchParams.get('s'))) return NextResponse.json({ error: 'link inválido' }, { status: 403 });
  const res = await renderPostArt(id);
  return res ?? NextResponse.json({ error: 'arte não encontrada' }, { status: 404 });
}
