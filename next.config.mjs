/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produit .next/standalone : un serveur autonome avec les seules dépendances
  // réellement utilisées, ce qui allège fortement l'image Docker.
  output: "standalone",
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    // Doit rester au-dessus de MAX_FILE_SIZE (lib/uploads.ts) : sans cela Next
    // rejetterait les devis et documents de plus de 1 Mo avant même d'exécuter
    // la server action, court-circuitant nos messages d'erreur.
    serverActions: { bodySizeLimit: "16mb" },
  },
};

export default nextConfig;
