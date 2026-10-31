export function BrandMark({ large }: { large?: boolean }) {
  const size = large ? 20 : 17;
  return <span className={`brand-mark ${large ? 'large' : ''}`} aria-hidden="true"><svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M5 5.5h9" /><path d="M5 12h14" /><path d="M5 18.5h6" /></svg></span>;
}
