import { motion } from "framer-motion";
import liveAlpha from "@/assets/live-alpha.webp";

const BookingSection = () => {
  return (
    <section id="contact" aria-label="Booking" className="pt-10 pb-4 md:pt-20 md:pb-8">
      <div className="container">
        <h2 className="text-sm tracking-[0.3em] text-primary mb-8 uppercase">
          // BOOKING - A DIRECT SIGNAL PATH
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image with scanlines */}
          <div className="scanline-overlay section-border overflow-hidden">
            <div className="overflow-hidden h-64 lg:h-full" style={{ margin: "-8px", padding: "8px" }}>
              <img
                src={liveAlpha}
                alt="Subspace Resonator performing live"
                width={1920}
                height={1080}
                className="w-full h-full object-cover scale-110"
                style={{ objectPosition: "50% 30%" }}
                loading="lazy"
              />
            </div>
          </div>

          {/* Copy */}
          <div className="section-border p-6 md:p-10 flex flex-col justify-center">
            <p className="text-base sm:text-sm leading-relaxed text-foreground mb-6">
              Subspace Resonator operates on a Direct-contact model, ensuring creative alignment and access to exclusive music available nowhere else.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <motion.a
                href="mailto:subspaceresonator@gmail.com"
                className="inline-flex items-center justify-center border border-primary text-primary text-xs sm:text-sm tracking-[0.2em] uppercase px-8 min-h-[44px] hover:bg-primary hover:text-primary-foreground transition-colors w-full sm:w-fit"
                whileHover={{ filter: "drop-shadow(0 0 16px hsl(210 100% 50% / 0.5))", transition: { duration: 0.2 } }}
              >
                INITIATE CONTACT
              </motion.a>

              <motion.a
                href="tel:+972507974184"
                className="inline-flex items-center justify-center border border-border text-foreground text-xs sm:text-sm tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-full sm:w-fit"
                whileHover={{ filter: "drop-shadow(0 0 12px hsl(210 100% 50% / 0.3))", transition: { duration: 0.2 } }}
              >
                FAST CHANNEL · CALL
              </motion.a>

              <motion.a
                href="https://wa.me/972507974184"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Contact via WhatsApp (opens in new tab)"
                className="inline-flex items-center justify-center border border-border text-foreground text-xs sm:text-sm tracking-[0.2em] uppercase px-8 min-h-[44px] hover:border-primary hover:text-primary transition-colors w-full sm:w-fit"
                whileHover={{ filter: "drop-shadow(0 0 12px hsl(210 100% 50% / 0.3))", transition: { duration: 0.2 } }}
              >
                WHATSAPP · CHAT
              </motion.a>
            </div>

            <div className="mt-4 space-y-1">
              <p className="text-sm text-muted-foreground tracking-wider">
                subspaceresonator@gmail.com
              </p>
              <p className="text-sm text-muted-foreground tracking-wider">
                <a href="tel:+972507974184" className="hover:text-primary transition-colors">
                  +972-50-7974184
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookingSection;
