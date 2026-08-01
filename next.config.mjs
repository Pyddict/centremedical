/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    // Doit rester au-dessus de MAX_FILE_SIZE (lib/uploads.ts) : sans cela Next
    // rejetterait les devis et documents de plus de 1 Mo avant même d'exécuter
    // la server action, court-circuitant nos messages d'erreur.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
