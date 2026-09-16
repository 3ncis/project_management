import { NextRequest,NextResponse } from 'next/server';
import { resolveViewer } from '@/lib/viewer';
import { isSameOrigin } from '@/lib/auth';
import { markNotificationsRead } from '@/lib/database';
export async function POST(request:NextRequest){if(!isSameOrigin(request))return NextResponse.json({error:'Permintaan tidak diizinkan.'},{status:403});const viewer=await resolveViewer(request.nextUrl.searchParams.get('view')??undefined);if(!viewer||viewer.role!=='user')return NextResponse.json({error:'Akses khusus User.'},{status:403});await markNotificationsRead(viewer.slug);return NextResponse.json({message:'Notifikasi ditandai dibaca.'});}
