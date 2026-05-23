import { defineConfig, Plugin } from "vite";

const GEBCO_OPENDAP_ASCII_SOURCE =
  "https://dap.ceda.ac.uk/thredds/dodsC/bodc/gebco/global/gebco_2026/ice_surface_elevation/netcdf/GEBCO_2026.nc.ascii";
const GEBCO_PROXY_RETRIES = 2;

export default defineConfig({
  plugins: [gebcoOpendapProxy()],
});

function gebcoOpendapProxy(): Plugin {
  const middleware = async (req: any, res: any) => {
    const requestUrl = new URL(req.url ?? "", "http://localhost");
    const constraint = requestUrl.search.slice(1);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=86400");

    if (!constraint) {
      res.statusCode = 400;
      res.setHeader("Content-Type", "text/plain");
      res.end("Missing GEBCO OPeNDAP constraint");
      return;
    }

    try {
      const upstream = await fetchGebco(`${GEBCO_OPENDAP_ASCII_SOURCE}?${constraint}`, GEBCO_PROXY_RETRIES);
      res.statusCode = 200;
      res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "text/plain");
      res.end(await upstream.text());
    } catch (error) {
      console.error("GEBCO 2026 proxy failed", error);
      res.statusCode = 502;
      res.setHeader("Content-Type", "text/plain");
      res.end("GEBCO 2026 proxy failed");
    }
  };

  return {
    name: "gebco-2026-opendap-proxy",
    configureServer(server) {
      server.middlewares.use("/gebco/gebco_2026.ascii", middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/gebco/gebco_2026.ascii", middleware);
    }
  };
}

async function fetchGebco(url: string, retries: number): Promise<Response> {
  const response = await fetch(url, { headers: { Accept: "text/plain" } });
  if (response.ok) return response;

  await response.arrayBuffer().catch(() => undefined);
  if (retries <= 0) throw new Error(`GEBCO upstream returned ${response.status}`);
  await new Promise(resolve => setTimeout(resolve, 350 * (GEBCO_PROXY_RETRIES - retries + 1)));
  return fetchGebco(url, retries - 1);
}
