#!/usr/bin/env node
// Hôte de développement — implémente le côté HÔTE du contrat `onirtech.template-host.v1`.
//
// Mode backend générique : les actions appellent le vrai backend ONIR CMS
// (`/api/chat/session`, `/api/chat`, `/api/chat/media`, `/api/chat/finish`)
// via un proxy same-origin (sans CORS). Le jeton reste côté serveur du harness.
//
// Usage : node harness/host.mjs [--dir <dossier-du-template>] [--port 4500]
//                              [--api http://localhost:3000]
//                              [--token <jeton-du-lien>]
//
// Variables frontend/env (génériques) :
//   VITE_API_BASE / VITE_ONIR_API_BASE / API_BASE / ONIR_API_BASE  → backend
//   VITE_LINK_TOKEN / VITE_ONIR_LINK_TOKEN / LINK_TOKEN / ONIR_LINK_TOKEN → jeton
//   (fallback : --api/--base, --token, .onir-link-token)

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dirArg = opt("--dir", null);
const templateDir = dirArg
  ? resolve(process.cwd(), dirArg)
  : resolve(__dirname, "..", "template");
const port = Number(opt("--port", "4500"));

// Backend générique (configurable via variables frontend/env)
const apiBase = (
  process.env.VITE_API_BASE ||
  process.env.VITE_ONIR_API_BASE ||
  process.env.API_BASE ||
  process.env.ONIR_API_BASE ||
  process.env.HARNESS_BASE ||
  opt("--api", opt("--base", "http://localhost:3000"))
).replace(/\/+$/, "");

// Jeton du lien (générique)
const TOKEN_FILE = join(templateDir, ".onir-link-token");
let defaultToken = (
  process.env.VITE_LINK_TOKEN ||
  process.env.VITE_ONIR_LINK_TOKEN ||
  process.env.LINK_TOKEN ||
  process.env.ONIR_LINK_TOKEN ||
  process.env.HARNESS_TOKEN ||
  opt("--token", "")
).trim();
if (defaultToken === "") {
  try {
    defaultToken = (await readFile(TOKEN_FILE, "utf8")).trim();
  } catch {
    defaultToken = "";
  }
}

function buildParams(manifest, overrides = {}) {
  const declared = Array.isArray(manifest.params) ? manifest.params : [];
  const params = Object.fromEntries(declared.map((param) => [param.key, param.default]));
  for (const param of declared) {
    const raw = overrides[param.key];
    if (raw === undefined) continue;
    switch (param.type) {
      case "number": {
        const value = Number(raw);
        if (Number.isFinite(value)) params[param.key] = value;
        break;
      }
      case "boolean":
        params[param.key] = raw === "1" || raw === "true";
        break;
      case "select":
        if ((param.options ?? []).some((option) => option.value === raw)) {
          params[param.key] = raw;
        }
        break;
      default:
        params[param.key] = raw;
        break;
    }
  }
  return params;
}

const MIME = {
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".html": "text/html",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

function hostPage(manifest, opts = {}) {
  const startChat = opts.phase === "chat";
  const consent = opts.consent === false
    ? null
    : { texte: "J'accepte la politique de confidentialité", lien: "https://example.com/confidentialite" };
  const ctx = {
    host: { protocol: "onirtech.template-host.v1", version: 1 },
    surface: "page",
    link: { type: "standard", label: "", userStateEnabled: true },
    locale: "fr",
    brand: { name: "", logoUrl: null },
    theme: { primary: "#023777", text: "#ffffff", background: "#101014" },
    consent,
    capabilities: manifest.capabilities,
    params: buildParams(manifest, opts.params),
    state: {
      phase: startChat ? "chat" : "identity",
      status: "en_cours",
      messages: [],
      typing: false,
      pendingAttachments: [],
      fallback: null,
    },
    resources: {
      media: { photos: [], liens: [] },
      modelForm: [],
    },
  };

  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Harness — ${manifest.id}</title>
<script type="importmap">{ "imports": { "@onirtech/template-sdk": "/sdk/index.js" } }</script>
<style>
  #harness-banner{position:fixed;inset:0 auto auto 0;width:100%;background:#0f172a;color:#e5e7eb;
    font:500 13px system-ui;padding:.35rem 1rem;text-align:center;z-index:99999;border-bottom:1px solid #334155}
  body{margin:0;padding-top:2rem;font-family:system-ui;background:#f8fafc}
  #harness-help{position:fixed;right:10px;bottom:10px;z-index:99999;font:12px system-ui;
    background:#111827;color:#e5e7eb;border-radius:8px;padding:.5rem .7rem;opacity:.9}
  #harness-help a{color:#93c5fd}
</style></head><body>
<div id="harness-banner">BACKEND — ${apiBase} · actions réelles (token: ${opts.token ? "configuré" : "manquant"})</div>
<div id="harness-help"><a href="?">accueil</a> · <a href="?phase=chat">chat</a></div>
<div id="host"></div>
<script type="module">
  const manifest = ${JSON.stringify(manifest)};
  const ctx = ${JSON.stringify(ctx)};
  const token = ${JSON.stringify(opts.token ?? null)};
  const conversationId = { value: null };
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const listeners = new Map();
  const emit = (e, p) => (listeners.get(e) || new Set()).forEach((cb) => cb(p));
  const now = () => new Date().toISOString();
  const nextId = (prefix) => prefix + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);

  async function api(path, payload, method = "POST") {
    const res = await fetch(path, {
      method,
      headers: payload !== undefined ? { "content-type": "application/json" } : {},
      body: payload !== undefined ? JSON.stringify(payload) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || ("HTTP " + res.status));
    return data;
  }
  async function apiGet(path) {
    const res = await fetch(path, { headers: { accept: "application/json" } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || ("HTTP " + res.status));
    return data;
  }

  // Fusionne les données backend dans le contexte (tous les éléments pilotés par backend)
  function mergeCtx(source) {
    if (!source || typeof source !== "object") return;
    if (source.brand && typeof source.brand === "object") ctx.brand = { ...ctx.brand, ...source.brand };
    if (source.theme && typeof source.theme === "object") ctx.theme = { ...ctx.theme, ...source.theme };
    if (source.link && typeof source.link === "object") ctx.link = { ...ctx.link, ...source.link };
    if (typeof source.locale === "string" && source.locale) ctx.locale = source.locale;
    if (Object.prototype.hasOwnProperty.call(source, "consent")) ctx.consent = source.consent;
    if (Array.isArray(source.capabilities)) ctx.capabilities = source.capabilities;
    if (source.params && typeof source.params === "object") ctx.params = { ...ctx.params, ...source.params };
    if (source.config && typeof source.config === "object") ctx.params = { ...ctx.params, ...source.config };
    if (source.resources && typeof source.resources === "object") {
      ctx.resources = { ...ctx.resources, ...source.resources };
      if (source.resources.media) ctx.resources.media = { ...ctx.resources.media, ...source.resources.media };
    }
    if (source.media && typeof source.media === "object") ctx.resources.media = { ...ctx.resources.media, ...source.media };
    if (Array.isArray(source.modelForm)) ctx.resources.modelForm = source.modelForm;
    if (source.state && typeof source.state === "object") ctx.state = { ...ctx.state, ...source.state };
    if (typeof source.conversationId === "string") conversationId.value = source.conversationId;
  }

  async function bootstrap() {
    if (!token) { render(); return; }
    const qs = "?token=" + encodeURIComponent(token);
    const candidates = [
      "/api/chat/context" + qs,
      "/api/chat/link" + qs,
      "/api/chat/bootstrap" + qs,
      "/api/link" + qs,
      "/api/links/resolve" + qs,
    ];
    for (const path of candidates) {
      try { mergeCtx(await apiGet(path)); } catch {}
    }
    render();
  }

  const actions = {
    submitIdentity: async (data) => {
      try {
        const payload = await api("/api/chat/session", {
          token,
          surface: "page",
          nom: data.nom,
          email: data.email,
          consentement: data.consentement ?? true,
          contacts: data.contacts ?? [],
          loadedAt: Date.now() - 3000,
        });
        mergeCtx(payload);
        conversationId.value = typeof payload?.conversationId === "string" ? payload.conversationId : conversationId.value;
        ctx.state.phase = "chat";
        if (Array.isArray(payload?.messages)) ctx.state.messages = payload.messages;
        ctx.state.typing = false;
        ctx.state.fallback = null;
        render();
        return true;
      } catch (err) {
        console.error("[harness] session:", err);
        return false;
      }
    },
    sendMessage: async (content, requestedIds) => {
      const text = typeof content === "string" ? content.trim() : "";
      const pending = Array.isArray(ctx.state.pendingAttachments) ? ctx.state.pendingAttachments : [];
      const attachments = requestedIds === undefined || requestedIds.length === 0
        ? pending
        : pending.filter((a) => requestedIds.includes(a.id));
      if (text === "" && attachments.length === 0) return false;

      ctx.state.messages.push({
        id: nextId("u"),
        role: "user",
        content: text,
        medias: [],
        at: now(),
        ...(attachments.length > 0 ? { attachments } : {}),
      });
      ctx.state.pendingAttachments = pending.filter((a) => !attachments.includes(a.id));
      ctx.state.fallback = null;
      render();

      if (!conversationId.value) return false;
      ctx.state.typing = true;
      render();
      try {
        const payload = await api("/api/chat", {
          conversationId: conversationId.value,
          content: text,
        });
        ctx.state.typing = false;
        const answer = payload?.message && typeof payload.message.content === "string"
          ? payload.message.content
          : "";
        const assistantMsg = {
          id: (payload?.message && payload.message.id) || nextId("a"),
          role: "assistant",
          content: answer,
          medias: Array.isArray(payload?.message?.medias) ? payload.message.medias : [],
          at: payload?.message?.at || now(),
          ...(Array.isArray(payload?.message?.knowledge) ? { knowledge: payload.message.knowledge } : {}),
        };
        if (answer || assistantMsg.medias.length || assistantMsg.knowledge) {
          ctx.state.messages.push(assistantMsg);
        }
        if (payload?.mediaPending && assistantMsg.id) {
          try {
            const media = await api("/api/chat/media", { conversationId: conversationId.value, messageId: assistantMsg.id });
            const msg = ctx.state.messages.find((m) => m.id === assistantMsg.id);
            if (msg && Array.isArray(media?.medias)) msg.medias = media.medias;
          } catch {}
        }
      } catch (err) {
        console.error("[harness] chat:", err);
        ctx.state.typing = false;
      }
      render();
      return true;
    },
    attachFile: async (fieldName, file) => {
      const field = (ctx.resources.modelForm || []).find((entry) => entry.name === fieldName);
      const attachment = {
        id: nextId("att"),
        fieldName,
        fieldLabel: field?.label ?? fieldName,
        originalName: file.name,
        mime: file.type || "application/octet-stream",
        sizeBytes: file.size,
        url: typeof URL.createObjectURL === "function" ? URL.createObjectURL(file) : "",
        createdAt: now(),
      };
      ctx.state.pendingAttachments = [...(ctx.state.pendingAttachments || []), attachment];
      render();
    },
    removeAttachment: async (attachmentId) => {
      ctx.state.pendingAttachments = (ctx.state.pendingAttachments || []).filter(
        (attachment) => attachment.id !== attachmentId,
      );
      render();
    },
    finish: async () => {
      if (conversationId.value) {
        try {
          const payload = await api("/api/chat/finish", { conversationId: conversationId.value });
          if (payload?.outcome === "succeeded") ctx.state.status = "finalisee";
        } catch (err) {
          console.error("[harness] finish:", err);
        }
      }
      ctx.state.typing = false;
      render();
      return true;
    },
    selectFallback: (questionId) => {
      const menu = ctx.state.fallback;
      const question = menu?.questions?.find((entry) => entry.id === questionId);
      if (!question) return;
      ctx.state.fallback = null;
      // Délègue au flux réel si disponible
      actions.sendMessage(question.label);
    },
    openCollectionForm: () => {
      ctx.state.fallback = null;
      render();
    },
    request: async (capability) => {
      const cid = conversationId.value;
      try {
        if (capability === "media") {
          const data = cid
            ? await apiGet("/api/chat/media?conversationId=" + encodeURIComponent(cid))
            : await apiGet("/api/chat/media?token=" + encodeURIComponent(token || ""));
          if (data && typeof data === "object") {
            const media = data.media && typeof data.media === "object" ? data.media : data;
            ctx.resources.media = { ...ctx.resources.media, ...media };
            render();
          }
        } else if (capability === "modelForm") {
          const data = await apiGet("/api/chat/model-form?token=" + encodeURIComponent(token || "") + (cid ? "&conversationId=" + encodeURIComponent(cid) : ""));
          const form = Array.isArray(data) ? data : Array.isArray(data?.modelForm) ? data.modelForm : Array.isArray(data?.fields) ? data.fields : null;
          if (form) { ctx.resources.modelForm = form; render(); }
        } else {
          const data = await apiGet("/api/chat/context?token=" + encodeURIComponent(token || ""));
          mergeCtx(data);
          render();
        }
      } catch {}
      if (capability === "media") return ctx.resources.media;
      if (capability === "modelForm") return ctx.resources.modelForm;
      return ctx.theme;
    },
    openMedia: (url) => window.open(url, "_blank", "noopener"),
    resize: () => {},
    openWidget: () => {},
    closeWidget: () => {},
  };

  const on = (event, cb) => {
    const set = listeners.get(event) || new Set();
    set.add(cb);
    listeners.set(event, set);
    return () => set.delete(cb);
  };
  const liveCtx = () => ({ ...clone(ctx), actions, on });

  await import("/template/" + manifest.ui.entry.replace(/^\.\\//, ""));
  const host = document.getElementById("host");
  let element = document.querySelector(manifest.ui.element);
  function render() {
    if (!element) {
      element = document.createElement(manifest.ui.element);
      host.replaceChildren(element);
    }
    element.onirtechContext = liveCtx();
    emit("state", ctx.state);
  }
  bootstrap();
  window.__harness = { ctx, actions, render, conversationId, mergeCtx };
</script></body></html>`;
}

async function proxyApi(req, res) {
  const target = apiBase + req.url;
  const method = req.method || "GET";
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const headers = {};
  if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
  if (req.headers["accept"]) headers["accept"] = req.headers["accept"];
  try {
    const upstream = await fetch(target, { method, headers, body: ["GET", "HEAD"].includes(method) ? undefined : body });
    const payload = Buffer.from(await upstream.arrayBuffer());
    const out = { "content-type": upstream.headers.get("content-type") ?? "application/json" };
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter !== null) out["retry-after"] = retryAfter;
    res.writeHead(upstream.status, out);
    res.end(payload);
  } catch (error) {
    res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: "Backend injoignable (" + apiBase + ") : " + error.message }));
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/api/")) {
      await proxyApi(req, res);
      return;
    }
    if (url.pathname === "/") {
      const manifest = JSON.parse(await readFile(join(templateDir, "onirtech.template.json"), "utf8"));
      const params = {};
      for (const param of Array.isArray(manifest.params) ? manifest.params : []) {
        const value = url.searchParams.get(param.key);
        if (value !== null) params[param.key] = value;
      }
      const opts = {
        phase: url.searchParams.get("phase") || "identity",
        consent: url.searchParams.get("consent") !== "0",
        fallback: url.searchParams.get("fallback") === "1",
        params,
        token: (url.searchParams.get("token") ?? "").trim() || defaultToken || "",
      };
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(hostPage(manifest, opts));
      return;
    }
    if (url.pathname === "/sdk/index.js") {
      try {
        const file = join(templateDir, "node_modules", "@onirtech", "template-sdk", "dist", "index.js");
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(data);
      } catch {
        if (res.headersSent) res.destroy();
        else res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("SDK non installé : lancez « npm install ».");
      }
      return;
    }
    if (url.pathname.startsWith("/template/")) {
      const rel = normalize(url.pathname.slice("/template/".length));
      if (rel.startsWith("..")) {
        res.writeHead(400).end("bad path");
        return;
      }
      const file = join(templateDir, rel);
      const data = await readFile(file);
      res.writeHead(200, { "Content-Type": MIME[extname(file)] ?? "application/octet-stream" });
      res.end(data);
      return;
    }
    res.writeHead(404).end("not found");
  } catch (error) {
    console.error("[harness] erreur de requête :", error);
    if (res.headersSent) res.destroy();
    else res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" }).end("error");
  }
});

server.on("clientError", (_error, socket) => {
  if (socket.writable) socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

server.listen(port, () => {
  console.log(`Harness — http://localhost:${port}`);
  console.log(`Template : ${templateDir}`);
  console.log(`Backend  : ${apiBase}`);
  console.log(
    defaultToken === ""
      ? "Token    : (manquant) — définissez VITE_LINK_TOKEN/ONIR_LINK_TOKEN, --token ou .onir-link-token"
      : `Token    : configuré (${defaultToken.slice(0, 6)}…)`,
  );
});
