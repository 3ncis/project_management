'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { parseNibText } from '@/lib/nib-parser';

type Row = Record<string,string|number|null>;
function fileToBase64(file:File){return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]??'');reader.onerror=()=>reject(new Error('Dokumen tidak dapat dibaca.'));reader.readAsDataURL(file);});}

async function prepareForOcr(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.max(1, Math.min(2.4, 1700 / bitmap.width));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = image.data[index] * .299 + image.data[index + 1] * .587 + image.data[index + 2] * .114;
    const value = Math.max(0, Math.min(255, Math.round((gray - 128) * 1.35 + 128)));
    image.data[index] = value; image.data[index + 1] = value; image.data[index + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return canvas;
}

async function originalDimensions(file:File){const bitmap=await createImageBitmap(file);const dimensions={width:bitmap.width,height:bitmap.height};bitmap.close();return dimensions;}

async function renderPdfPages(file: File) {
  const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
    import('pdfjs-dist/legacy/build/pdf.mjs'),
    import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?raw'),
  ]);
  if (!GlobalWorkerOptions.workerPort) {
    const workerUrl = URL.createObjectURL(new Blob([workerModule.default], { type: 'text/javascript' }));
    GlobalWorkerOptions.workerPort = new Worker(workerUrl, { type: 'module', name: 'nib-pdf-ocr' });
  }
  const loadingTask = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await loadingTask.promise;
  if (pdf.numPages > 10) throw new Error('PDF maksimal 10 halaman. Pisahkan dokumen lalu upload kembali.');
  const pages: HTMLCanvasElement[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.max(1.5, Math.min(2.4, 1800 / baseViewport.width));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Halaman PDF tidak dapat dirender.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    pages.push(canvas);
  }
  await loadingTask.destroy();
  return pages;
}

export function NibUploader({ documents, kbli, slug }: { documents: Row[]; kbli: Row[]; slug:string }) {
  const router=useRouter(); const [progress,setProgress]=useState(''); const [message,setMessage]=useState(''); const [pending,setPending]=useState(false);
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const formElement=event.currentTarget;const form=new FormData(formElement);const file=form.get('nib') as File;if(!file?.size)return;if(file.size>8*1024*1024){setMessage('Ukuran dokumen maksimal 8 MB.');return;}const isPdf=file.type==='application/pdf';if(!isPdf&&!['image/jpeg','image/png','image/webp'].includes(file.type)){setMessage('Format harus PDF, JPG, PNG, atau WebP.');return;}setPending(true);setMessage('');setProgress(isPdf?'Menyiapkan halaman PDF…':'Menyiapkan gambar agar teks lebih jelas…');let worker:Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>|null=null;try{const {createWorker,PSM}=await import('tesseract.js');worker=await createWorker('eng',1,{logger:(item)=>{if(item.status==='recognizing text')setProgress(`Membaca NIB ${Math.round((item.progress??0)*100)}%`);}});let text='';if(isPdf){const pages=await renderPdfPages(file);for(let index=0;index<pages.length;index+=1){setProgress(`Membaca PDF halaman ${index+1} dari ${pages.length}…`);const result=await worker.recognize(pages[index]);text+=`\nHALAMAN ${index+1}\n${result.data.text}`;}}else{const prepared=await prepareForOcr(file);const result=await worker.recognize(prepared);text=result.data.text;}let extraction=parseNibText(text);if(!isPdf&&!extraction.kbli.length){setProgress('Memeriksa kolom KBLI pada tabel…');const size=await originalDimensions(file);await worker.setParameters({tessedit_pageseg_mode:PSM.SINGLE_BLOCK});const regions=[{left:.11,top:.3,width:.18,height:.07},{left:.08,top:.28,width:.24,height:.12}];for(const region of regions){const focused=await worker.recognize(file,{rectangle:{left:Math.round(size.width*region.left),top:Math.round(size.height*region.top),width:Math.round(size.width*region.width),height:Math.round(size.height*region.height)}});text+=`\nKode KBLI\n${focused.data.text}`;extraction=parseNibText(text);if(extraction.kbli.length)break;}}if(!extraction.nibNumber)throw new Error('Nomor NIB 13 digit belum terbaca. Gunakan dokumen yang lebih tajam dan tidak terpotong.');if(!extraction.kbli.length)throw new Error('Kode KBLI pada tabel belum ditemukan. Kode pos tidak akan dianggap sebagai KBLI.');setProgress('Memeriksa data KBLI dan menyimpan dokumen…');const response=await fetch(`/api/nib?view=${encodeURIComponent(slug)}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({originalFilename:file.name,mimeType:file.type,imageBase64:await fileToBase64(file),ocrText:text,nibNumber:extraction.nibNumber,kbli:extraction.kbli})});const data=await response.json() as {message?:string;error?:string;code?:string};if(!response.ok)throw new Error(data.error??'Upload gagal.');setMessage(data.message??'NIB tersimpan.');setProgress('');formElement.reset();router.refresh();}catch(error){setMessage(error instanceof Error?error.message:'OCR gagal.');setProgress('');}finally{if(worker)await worker.terminate().catch(()=>undefined);setPending(false);}}
  return <section className="data-panel nib-panel" id="nib"><div className="section-heading"><div><span className="kicker">PROFIL LEGAL PENYEDIA</span><h2>Upload NIB & OCR KBLI</h2><p>Upload PDF atau gambar. OCR membaca nomor NIB 13 digit dan kode KBLI; data KBLI yang sama tidak akan disimpan ulang.</p></div><span className="record-count">{kbli.length} KBLI</span></div><form className="nib-form" onSubmit={submit}><label>Dokumen surat NIB (PDF atau gambar)<input name="nib" type="file" accept="application/pdf,image/jpeg,image/png,image/webp,.pdf" required /></label><button className="button button-yellow" disabled={pending}>{pending?'Memproses…':'Baca OCR & Simpan'}</button></form>{progress&&<div className="ocr-progress">● {progress}</div>}{message&&<p className="form-message" role="alert">{message}</p>}<div className="kbli-list">{kbli.length?kbli.map((item,index)=><div className="kbli-card" key={`${item.kbli_code}-${index}`}><strong>KBLI {String(item.kbli_code)}</strong><small>{String(item.kbli_title||'Judul KBLI belum tersedia')}</small></div>):<small>Belum ada KBLI tersimpan.</small>}</div>{documents.length>0&&<div className="nib-history">{documents.map((item)=><div key={String(item.id)}><strong>{String(item.original_filename)}</strong><small>{item.nib_number?`NIB ${String(item.nib_number)} · `:''}{String(item.status).replaceAll('_',' ')} · {new Date(String(item.created_at)).toLocaleDateString('id-ID')}</small></div>)}</div>}</section>;
}
