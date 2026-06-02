import { motion } from 'framer-motion';
import liveAlpha from '../assets/live-alpha.jpg';

export default function BookingSection() {
  return (
    <section id="contact" aria-label="Booking" className="py-20 border-t border-border">
      <div className="container">
        <p className="text-xs font-mono tracking-widest text-primary mb-12">// BOOKING — A DIRECT SIGNAL PATH</p>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left: live photo */}
          <div className="hidden lg:block">
            <img
              src={liveAlpha}
              alt="Subspace Resonator live performance"
              className="w-full aspect-[4/3] object-cover border border-border"
            />
          </div>

          {/* Right: copy + buttons */}
          <div>
            <p className="text-base text-muted-foreground mb-8">
              Available for festivals, club nights, and private events. Full live set or DJ set, 60 to 180 minutes.
              Technical rider on request. Direct booking — no agency fees. Based in Tel Aviv, touring internationally.
            </p>

            {/* Live dates */}
            <div className="mb-6 pb-6 border-b border-border">
              <p className="text-xs tracking-widest text-muted-foreground uppercase mb-3">// LIVE DATES</p>
              <p className="text-sm text-muted-foreground mb-3">
                Upcoming shows and festival dates posted on Instagram and Facebook.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/subspace_resonator"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  ↗ INSTAGRAM
                </a>
                <a
                  href="https://facebook.com/profile.php?id=61559198105695"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs tracking-widest uppercase text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                >
                  ↗ FACEBOOK
                </a>
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              <motion.a
                href="mailto:subspaceresonator@gmail.com"
                aria-label="Initiate Contact"
                className="border border-primary text-primary text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:bg-primary hover:text-primary-foreground transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                INITIATE CONTACT
              </motion.a>
              <motion.a
                href="tel:+972507974184"
                aria-label="Fast Channel · Call"
                className="border border-border text-muted-foreground text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:border-primary hover:text-primary transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                FAST CHANNEL · CALL
              </motion.a>
              <motion.a
                href="https://wa.me/972507974184"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp · Chat"
                className="border border-border text-muted-foreground text-xs tracking-widest uppercase px-6 min-h-[44px] inline-flex items-center hover:border-primary hover:text-primary transition-colors"
                whileHover={{ boxShadow: '0 0 20px hsl(var(--primary) / 0.4)' }}
              >
                WHATSAPP · CHAT
              </motion.a>
            </div>

            <div className="mt-4 flex gap-6 text-xs text-muted-foreground">
              <span>subspaceresonator@gmail.com</span>
              <span>+972507974184</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
