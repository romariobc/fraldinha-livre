import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
