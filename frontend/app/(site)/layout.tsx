import { SiteFooter, SiteHeader, WhatsAppFab } from "@/components/site/SiteChrome";

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-cream-100">
      <SiteHeader />
      <div>{children}</div>
      <SiteFooter />
      <WhatsAppFab />
    </div>
  );
}
