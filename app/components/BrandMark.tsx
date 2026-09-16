import Image from 'next/image';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return <div className={`brand-mark ${compact ? 'compact' : ''}`} aria-label="Padma Shri Teknologi"><span className="brand-emblem" aria-hidden="true"><i /><Image src="/padma-shri-logo.png" width={52} height={52} alt="" priority /></span>{!compact && <span className="brand-name"><strong>PADMA SHRI</strong><small>TEKNOLOGI</small></span>}</div>;
}
