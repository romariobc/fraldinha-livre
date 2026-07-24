import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: path.join(__dirname, ".."),
  },
  // @fraldinha-livre/contracts e consumido como fonte TS (sem build proprio) via
  // npm workspace — isto instrui o Next a transpilir o pacote como se fosse
  // codigo de 1a parte, em vez de esperar JS ja compilado em node_modules.
  transpilePackages: ["@fraldinha-livre/contracts"],
};

export default nextConfig;
