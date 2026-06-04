export default function Footer() {
  return (
    <footer className="border-t border-border py-8 mt-20">
      <div className="container flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-muted-foreground tracking-widest uppercase">
          © 2026 SUBSPACE RESONATOR · ALL FREQUENCIES RESERVED
        </p>
        <div className="flex gap-4 text-xs">
          <a
            href="mailto:subspaceresonator@gmail.com"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            subspaceresonator@gmail.com
          </a>
          <a
            href="tel:+972507974184"
            className="text-muted-foreground hover:text-primary transition-colors"
          >
            +972507974184
          </a>
        </div>
      </div>
    </footer>
  );
}
