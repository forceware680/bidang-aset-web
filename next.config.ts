import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Skema database dikelola lewat db/schema.sql, bukan prisma migrate.
  serverExternalPackages: ["@prisma/client"],
  // Output standalone dipakai Dockerfile: server hanya butuh file yang benar-benar dipakai.
  output: "standalone",
  experimental: {
    // Upgrade keamanan dari `next upgrade --agent=security` (16.4.3 -> 16.4.6); nilai ini menandai
    // bahwa upgrade ini dijalankan untuk advisory keamanan.
    agentUpgrade: "security",
    serverActions: {
      // Server action harus menerima berkas sedikit di atas batas 20 MB supaya pemeriksaan
      // di lib/uploads.ts yang memberi pesan ke pengguna, bukan error 413 dari Next.
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
