import { env } from 'cloudflare:workers';
import { NextRequest,NextResponse } from 'next/server';
import { resolveViewer } from '@/lib/viewer';
import { isSameOrigin } from '@/lib/auth';
import { DuplicateKbliError,saveNibDocument } from '@/lib/database';

type UploadBody={originalFilename?:string;mimeType?:string;imageBase64?:string;ocrText?:string;nibNumber?:string;kbli?:unknown};
export async function POST(request:NextRequest){
  if(!isSameOrigin(request))return NextResponse.json({error:'Permintaan tidak diizinkan.'},{status:403});
  const viewer=await resolveViewer(request.nextUrl.searchParams.get('view')??undefined);if(!viewer||viewer.role!=='user')return NextResponse.json({error:'Akses khusus User.'},{status:403});
  const body=await request.json().catch(()=>null) as UploadBody|null;if(!body)return NextResponse.json({error:'Data unggahan tidak valid.'},{status:422});
  const mimeType=String(body.mimeType??'');const originalFilename=String(body.originalFilename??'nib').slice(0,200);const imageBase64=String(body.imageBase64??'');
  if(!['application/pdf','image/jpeg','image/png','image/webp'].includes(mimeType))return NextResponse.json({error:'Format harus PDF, JPG, PNG, atau WebP.'},{status:422});
  if(!imageBase64||imageBase64.length>11_200_000)return NextResponse.json({error:'Dokumen NIB wajib diisi dan maksimal 8 MB.'},{status:422});
  let bytes:Uint8Array;try{bytes=Uint8Array.from(atob(imageBase64),(character)=>character.charCodeAt(0));}catch{return NextResponse.json({error:'Data dokumen tidak dapat dibaca.'},{status:422});}
  if(!bytes.length||bytes.length>8*1024*1024)return NextResponse.json({error:'Dokumen NIB wajib diisi dan maksimal 8 MB.'},{status:422});
  const ocrText=String(body.ocrText??'').slice(0,50000);const nibNumber=String(body.nibNumber??'').trim();if(!/^\d{13}$/.test(nibNumber))return NextResponse.json({error:'Nomor NIB harus terdiri dari 13 digit.'},{status:422});
  const rawItems=Array.isArray(body.kbli)?body.kbli:[];const items=rawItems.filter((item):item is {code:string;title:string;confidence?:number}=>Boolean(item)&&typeof item==='object'&&/^\d{5}$/.test(String((item as {code?:unknown}).code??''))).map((item)=>({code:item.code,title:String(item.title??'').trim().slice(0,300)||`KBLI ${item.code} (hasil OCR)`,confidence:Math.max(0,Math.min(100,Number(item.confidence??85)))})).filter((item,index,array)=>array.findIndex((other)=>other.code===item.code)===index).slice(0,50);if(!items.length)return NextResponse.json({error:'Kode KBLI belum ditemukan.'},{status:422});
  const extension=mimeType==='application/pdf'?'pdf':mimeType==='image/png'?'png':mimeType==='image/webp'?'webp':'jpg';const objectKey=`users/${viewer.slug}/nib/${crypto.randomUUID()}.${extension}`;const bucket=(env as unknown as {NIB_FILES?:R2Bucket}).NIB_FILES;if(!bucket)return NextResponse.json({error:'Penyimpanan NIB belum tersedia.'},{status:503});
  try{await bucket.put(objectKey,bytes,{httpMetadata:{contentType:mimeType},customMetadata:{user:viewer.slug,category:'nib',nibNumber}});const saved=await saveNibDocument(viewer.slug,{objectKey,name:originalFilename,type:mimeType,size:bytes.length},ocrText,nibNumber,items);return NextResponse.json({message:`NIB ${saved.nibNumber} tersimpan. ${saved.kbli.length} kode KBLI ditemukan.`,nibNumber:saved.nibNumber,kbli:saved.kbli});}catch(error){await bucket.delete(objectKey).catch(()=>undefined);if(error instanceof DuplicateKbliError)return NextResponse.json({error:`Data sudah ada: KBLI ${error.codes.join(', ')} telah tersimpan untuk user ini.`,code:'KBLI_ALREADY_EXISTS',duplicates:error.codes},{status:409});return NextResponse.json({error:error instanceof Error?error.message:'Dokumen gagal disimpan.'},{status:422});}
}
