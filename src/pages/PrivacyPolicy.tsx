import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

const LAST_UPDATED = "13 July 2026";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "Privacy Policy | Subspace Resonator";
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container max-w-3xl py-16 md:py-24">
        <a
          href="/"
          className="inline-flex items-center gap-2 text-[11px] tracking-[0.25em] uppercase text-muted-foreground hover:text-primary transition-colors mb-10"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to site
        </a>

        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-[11px] text-muted-foreground tracking-[0.2em] uppercase mb-10">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <p>
              This policy explains how the Subspace Resonator website
              (subspaceresonator.com) handles information. It covers this landing
              page. The live radio room at /radio is a separate feature and is not
              covered here.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Information we collect</h2>
            <p>
              This landing page has no contact form, sign-up, newsletter, or login.
              We do not ask you to enter any personal details. Booking contact is
              handled entirely through your own email, phone, or WhatsApp app using
              the links on the site, so nothing you type there passes through this
              website.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Cookies and analytics</h2>
            <p className="mb-3">
              We use Google Analytics 4 (measurement ID G-NS6G58SSCJ) to understand,
              in aggregate, how people use the site. Analytics cookies are set only
              after you press Accept in the cookie banner. Until then Google Analytics
              runs in a cookieless mode and does not store cookies on your device. If
              you press Decline, no analytics cookies are ever set.
            </p>
            <p className="mb-3">
              When enabled, Google Analytics records anonymous usage such as page
              views and a small number of interaction events: booking link clicks,
              social link clicks, music play, and release clicks. These events carry
              no name, email, phone number, or other identifying detail.
            </p>
            <p>
              Google Analytics is provided by Google. You can review how Google
              handles data at policies.google.com/privacy. You can change or withdraw
              your choice at any time by clearing this site's data in your browser,
              which brings the cookie banner back.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Data security and sharing</h2>
            <p>
              Because the landing page collects no personal data through forms, there
              is no personal database to secure or share. We do not sell or rent data,
              and we do not send marketing email or SMS from this site.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Your rights and contact</h2>
            <p>
              For any privacy question, or to ask what data relating to you may exist,
              contact us:
            </p>
            <ul className="mt-3 space-y-1">
              <li>
                Email:{" "}
                <a href="mailto:subspaceresonator@gmail.com" className="text-primary hover:underline">
                  subspaceresonator@gmail.com
                </a>
              </li>
              <li>
                Phone:{" "}
                <a href="tel:+972507974184" className="text-primary hover:underline">
                  +972-50-7974184
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-foreground mb-2">Changes to this policy</h2>
            <p>
              If the site starts collecting personal data (for example a booking form
              or mailing list), this policy will be updated before that goes live and
              the date above will change.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
