import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createRequire } from "node:module";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { server as wisp } from "@mercuryworkshop/wisp-js/server";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const staticRoot = __dirname;
const app = express();
const require = createRequire(import.meta.url);

app.disable("x-powered-by");

app.use((_req, res, next) => {
res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
next();
});

const dirOf = (specifier) =>
path.dirname(require.resolve(specifier));

app.use("/scram/", express.static(scramjetPath));
app.use(
"/utils/",
express.static(dirOf("@mercuryworkshop/scramjet-utils"))
);
app.use(
"/controller/",
express.static(dirOf("@mercuryworkshop/scramjet-controller"))
);
app.use(
"/libcurl/",
express.static(dirOf("@mercuryworkshop/libcurl-transport"))
);

// Keep server/configuration files from being exposed as static files.
app.use((req, res, next) => {
const pathname = new URL(
req.url ?? "/",
"http://localhost"
).pathname;

const blockedFiles = new Set([
    "/server.js",
    "/package.json",
    "/package-lock.json",
    "/README.md",
    "/LICENSE",
    "/.gitignore"
]);

if (blockedFiles.has(pathname)) {
    res.status(404).end();
    return;
}

next();

});

// The project files are uploaded directly to the repository root.
app.use(
express.static(staticRoot, {
index: "index.html",
setHeaders(res, filePath) {
if (path.basename(filePath) === "sw.js") {
res.setHeader("Cache-Control", "no-cache");
}
}
})
);

// Friendly fallback for unknown page routes.
app.use((req, res) => {
if (req.method === "GET" && !path.extname(req.path)) {
res.sendFile(path.join(staticRoot, "index.html"));
return;
}

res.status(404).send("Not found");

});

const server = http.createServer(app);

server.on("upgrade", (req, socket, head) => {
const pathname = new URL(
req.url ?? "/",
"http://localhost"
).pathname;

if (pathname === "/wisp/") {
    req.url = pathname;
    wisp.routeRequest(req, socket, head);
    return;
}

socket.end();

});

const port = Number(process.env.PORT) || 8080;

server.listen(port, "0.0.0.0", () => {
console.log("Seasonal OS Proxy listening on port ${port}");
});

for (const signal of ["SIGINT", "SIGTERM"]) {
process.on(signal, () => {
server.close(() => process.exit(0));
});
}
