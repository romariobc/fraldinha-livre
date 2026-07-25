import { Container, getRandom } from "@cloudflare/containers";

interface Env {
  FRONTEND_CONTAINER: DurableObjectNamespace<FrontendContainer>;
}

export class FrontendContainer extends Container {
  defaultPort = 8080;
  sleepAfter = "10m";
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const container = await getRandom(env.FRONTEND_CONTAINER, 1);
    return container.fetch(request);
  },
};
