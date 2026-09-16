'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
type Row=Record<string,string|number|null>;
export function TenderNotifications({items,slug}:{items:Row[];slug:string}){const router=useRouter();const[pending,setPending]=useState(false);if(!items.length)return null;async function read(){setPending(true);await fetch(`/api/notifications/read?view=${encodeURIComponent(slug)}`,{method:'POST'});setPending(false);router.refresh();}return <section className="tender-notification"><span className="notification-icon">!</span><div><strong>{items.length} pekerjaan Tender/PL baru ditemukan</strong><p>{items.slice(0,2).map((item)=>String(item.title)).join(' · ')}</p></div><a href="#opportunities">Lihat peluang</a><button onClick={read} disabled={pending}>{pending?'…':'Tandai dibaca'}</button></section>}
