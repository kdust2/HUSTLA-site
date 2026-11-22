import { Link } from 'wouter';

export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <nav className={`legal-links ${className}`} aria-label="Legal">
      <Link href="/terms" data-testid="link-terms">Terms</Link>
      <Link href="/privacy" data-testid="link-privacy">Privacy</Link>
      <Link href="/refunds" data-testid="link-refunds">Refunds</Link>
      <Link href="/complaints" data-testid="link-complaints">Complaints</Link>
    </nav>
  );
}
