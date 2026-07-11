import { NextRequest } from 'next/server';
import { proxyToEdgeFunction } from '@/lib/proxy';

export async function POST(request: NextRequest) {
  return proxyToEdgeFunction('orders', request);
}
