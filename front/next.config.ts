import path from "path";
import type { NextConfig } from "next";

const monorepoRoot = path.join(__dirname, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  // MESMO valor de turbopack.root — evita o aviso "must have the same value"
  // e ancora a estrutura do standalone corretamente (sem isto o Next usa
  // front/ como raiz sozinho, conflitando com turbopack.root).
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    // O monorepo importa @contracts de ../packages/contracts; sem isto o
    // Turbopack limita a resolucao a front/ (raiz detectada pelo lockfile)
    // e "Module not found: Can't resolve '@contracts'" no next dev.
    root: monorepoRoot,
  },
  // @fraldinha-livre/contracts e consumido como fonte TS (sem build proprio) via
  // npm workspace — isto instrui o Next a transpilir o pacote como se fosse
  // codigo de 1a parte, em vez de esperar JS ja compilado em node_modules.
  transpilePackages: ["@fraldinha-livre/contracts"],
  // Proxy do handler de auth do Firebase (login mobile via signInWithRedirect) —
  // authDomain aponta pro proprio dominio do app (front/.env.production), entao
  // o SDK acessa /__/auth/* como same-origin em vez de iframe de terceiro, o que
  // navegadores mobile bloqueiam silenciosamente (storage partitioning). Ver
  // .claude/docs/decisoes.md D-034/D-035.
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://fraldinha-livre.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
