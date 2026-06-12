export default function RadioApp() {
  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <section className="section-border max-w-md w-full p-8 text-center">
        <p className="font-mono text-[11px] tracking-[0.35em] text-muted-foreground">
          // SUBSPACE RADIO
        </p>
        <h1 className="font-display text-3xl mt-4">SIGNAL OFFLINE</h1>
        <p className="font-mono text-xs mt-4 leading-relaxed text-muted-foreground">
          The transmission system is being assembled. First broadcast coming soon.
        </p>
        <a
          href="/"
          className="inline-block mt-6 font-mono text-xs tracking-widest underline underline-offset-4 min-h-[44px] leading-[44px]"
        >
          RETURN TO MAIN SITE
        </a>
      </section>
    </main>
  );
}
