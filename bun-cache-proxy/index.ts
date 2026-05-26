import { Command } from "commander";

interface CacheEntry {
    body: string;
    headers: [string, string][];
    status: number;
}

const cache = new Map<string, CacheEntry>();
const program = new Command();

program
    .name("caching-proxy")
    .description("A CLI caching proxy server built with Bun")
    .version("1.0.0")
    .option("-p, --port <number>", "Port on which the proxy server will run")
    .option("-o, --origin <url>", "The URL of the server to forward requests to")
    .option("-c, --clear-cache", "Clear the server cache")
    .action(async (options) => {

        // Handle the Cache Clearance command requirement
        if (options.clearCache) {
            // Look for a proxy running on the specified port, or fallback to default 3000
            const targetPort = options.port || "3000";
            try {
                const res = await fetch(`http://localhost:${targetPort}/__admin/clear`, { method: "POST" });
                if (res.ok) {
                    console.log("✨ Cache cleared successfully.");
                } else {
                    console.error("❌ Failed to clear cache via active server instance.");
                }
            } catch (err) {
                console.error(`❌ Could not connect to a running proxy on port ${targetPort} to clear cache.`);
            }
            process.exit(0);
        }

        // Validate requirements for starting the server
        if (!options.port || !options.origin) {
            console.error("❌ Error: Both --port and --origin options are required to start the proxy.");
            program.help();
            process.exit(1);
        }

        const PORT = parseInt(options.port, 10);
        // Ensure origin does not have a trailing slash to prevent double-slashes in URLs
        const ORIGIN = options.origin.endsWith("/") ? options.origin.slice(0, -1) : options.origin;

        const server = Bun.serve({
            port: PORT,
            async fetch(request) {
                const urlObj = new URL(request.url);

                // Internal endpoint to handle cross-process cache clearing
                if (urlObj.pathname === "/__admin/clear" && request.method === "POST") {
                    cache.clear();
                    return new Response("OK", { status: 200 });
                }

                // Forward matching pathnames exactly (e.g. /products -> http://dummyjson.com/products)
                const targetUrl = `${ORIGIN}${urlObj.pathname}${urlObj.search}`;

                // Only cache GET requests according to standard caching specs
                if (request.method !== "GET") {
                    return fetch(targetUrl, { method: request.method, headers: request.headers });
                }

                const cacheKey = `GET::${urlObj.pathname}${urlObj.search}`;

                // 1. Cache Hit Path
                if (cache.has(cacheKey)) {
                    const entry = cache.get(cacheKey)!;
                    const responseHeaders = new Headers(entry.headers);
                    responseHeaders.set("X-Cache", "HIT");

                    return new Response(entry.body, {
                        status: entry.status,
                        headers: responseHeaders,
                    });
                }

                // 2. Cache Miss Path
                try {
                    const originResponse = await fetch(targetUrl, { headers: request.headers });

                    const clonedResponse = originResponse.clone();
                    const bodyText = await clonedResponse.text();

                    const headersToStore: [string, string][] = [];
                    originResponse.headers.forEach((value, key) => {
                        if (key !== "content-encoding") {
                            headersToStore.push([key, value]);
                        }
                    });

                    // Save to server RAM cache map
                    cache.set(cacheKey, {
                        body: bodyText,
                        headers: headersToStore,
                        status: originResponse.status,
                    });

                    const clientHeaders = new Headers(originResponse.headers);
                    clientHeaders.set("X-Cache", "MISS");

                    return new Response(bodyText, {
                        status: originResponse.status,
                        headers: clientHeaders,
                    });

                } catch (error) {
                    return new Response(`Proxy Error reaching origin: ${(error as Error).message}\n`, { status: 502 });
                }
            },
        });

        console.log(`🚀 Caching Proxy started on port ${server.port}`);
        console.log(`🎯 Forwarding requests to ${ORIGIN}`);
    });

program.parse(process.argv);