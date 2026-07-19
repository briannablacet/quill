// Subtle attribution of which agent(s) power a given panel — portfolio
// demonstration text, not user-facing product copy, so it stays quiet.
export function AgentNote({ children }: { children: React.ReactNode }) {
  return <p className="pt-1 text-[11px] text-muted-foreground/60">Powered by: {children}</p>
}
