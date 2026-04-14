import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { setAdminCookie, clearAdminCookie } from '@/lib/auth';

export async function POST(request) {
  const { password, action } = await request.json();

  if (action === 'logout') {
    const cookieStore = cookies();
    clearAdminCookie(cookieStore);
    return NextResponse.json({ ok: true });
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const cookieStore = cookies();
  setAdminCookie(cookieStore);
  return NextResponse.json({ ok: true });
}
