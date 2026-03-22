import type { Metadata } from "next";
import { Manrope, Space_Grotesk } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Providers from '@/components/Providers';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
});

const displayFont = Space_Grotesk({
  subsets: ['latin'],
  variable: '--font-space-grotesk',
});

export const metadata: Metadata = {
  title: "CERNIQ — Institutional ALM Intelligence | 62 Modules, 34 Quant Models",
  description: "Enterprise ALM platform with 62 analytical modules, 34 quant models (Nelson-Siegel, Monte Carlo, CreditMetrics, Black-Litterman), COSSEC/NCUA/Basel III compliance, and bilingual EN/ES reporting. From $2,400/year.",
  keywords: "ALM software, asset liability management, credit union ALM, COSSEC compliance, NCUA ratios, Monte Carlo stress testing, NII sensitivity, EVE analysis, duration gap, CECL credit loss, yield curve modeling, bilingual ALM reports, Puerto Rico cooperativas, Basel IRRBB, CAMEL scoring, institutional risk intelligence, CERNIQ",
  metadataBase: new URL("https://cerniq.io"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "CERNIQ — 62 ALM Modules, 34 Quant Models, From $2,400/year",
    description: "Goldman Sachs-grade ALM intelligence at credit union pricing. COSSEC, NCUA, and Basel III compliant. Bilingual EN/ES reports. Try the interactive demo.",
    url: "https://cerniq.io",
    siteName: "CERNIQ",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CERNIQ — Institutional ALM Intelligence",
    description: "62 modules, 34 quant models, COSSEC/NCUA/Basel III compliant. From $2,400/year.",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const SEGMENT_WRITE_KEY = process.env.NEXT_PUBLIC_SEGMENT_WRITE_KEY;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${bodyFont.variable} ${displayFont.variable}`}>
        <Providers>
        {children}
        </Providers>
        {SEGMENT_WRITE_KEY && (
          <Script id="segment-analytics" strategy="afterInteractive">
            {`
              !function(){var i="analytics",analytics=window[i]=window[i]||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","screen","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware","register"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var key=analytics.methods[e];analytics[key]=analytics.factory(key)}analytics.load=function(key,e){var t=document.createElement("script");t.type="text/javascript";t.async=!0;t.setAttribute("data-global-segment-analytics-key",i);t.src="https://cdn.segment.com/analytics.js/v1/" + key + "/analytics.min.js";var n=document.getElementsByTagName("script")[0];n.parentNode.insertBefore(t,n);analytics._loadOptions=e};analytics._writeKey="${SEGMENT_WRITE_KEY}";analytics.SNIPPET_VERSION="5.2.1";analytics.load("${SEGMENT_WRITE_KEY}");analytics.page()}}();
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
