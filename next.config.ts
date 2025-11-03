import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // Exclude PDFKit and swissqrbill from bundling (use node_modules directly)
  serverExternalPackages: ['pdfkit', 'swissqrbill'],
};

export default withNextIntl(nextConfig);
