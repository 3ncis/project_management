import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'padma-shri-ai-tender-pl', version: '2.0-production', timestamp: new Date().toISOString() }, { headers: { 'cache-control': 'no-store' } });
}
