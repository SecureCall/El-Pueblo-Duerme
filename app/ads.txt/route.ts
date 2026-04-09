import { NextResponse } from 'next/server';

export async function GET() {
  const content = 'google.com, ca-pub-4807272408824742, DIRECT, f08c47fec0942fa0';
  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
