# Seasonal Os Proxy

A blue-and-white branded web proxy built from the ProxDocs minimal Scramjet starter.

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
npm start
```

Open the local URL printed by the server (usually `http://localhost:8080`). For service workers and the proxy engine, use HTTPS in production.

## Deploy on Render

1. Upload the contents of this project to a GitHub repository (upload the extracted files, not just the ZIP).
2. In Render, create a **Web Service** and connect the repository.
3. Use **Node** as the runtime.
4. Build command: `npm install`
5. Start command: `npm start`
6. Select a free instance if offered for your account/region, then deploy.
7. Test the deployed URL and verify the Wisp WebSocket tunnel at `/wisp/` and actual proxied navigation.

This app needs a persistent Node.js server and WebSocket upgrades. Do not deploy it as a static site or as a Vercel serverless-only application. Free hosts may sleep when idle and may have resource limits.

## Features

- Seasonal OS branding using the supplied leaf logo, with a blue-and-white browser interface
- Responsive mobile toolbar and address bar
- Existing Scramjet proxy engine and Wisp transport wiring
- Multiple tabs, browser controls, settings, history, and bookmarks

## Important notes

- HTTPS is required in production for service workers.
- Proxy compatibility varies by destination website.
- Review the included `LICENSE` (AGPL-3.0-only) before distributing or hosting modified copies for other people. Follow its applicable source-offer requirements.
- This is a web proxy, not a guarantee of anonymity. Avoid entering sensitive credentials into a proxy unless you understand the risks.
