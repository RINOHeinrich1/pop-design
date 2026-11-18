#!/usr/bin/env node
// Smoke test du VRAI backend Onirtech (session, chat Gemini, état, secours,
// messages). Aucun secret n'est affiché : le jeton du lien est déchiffré
// localement depuis la base de dev, ou fourni via --token / CHAT_LINK_TOKEN.
//
// Usage :
//   node tools/backend-check.mjs
//   node tools/backend-check.mjs --token <jeton> --base http://localhost:3000
//   node tools/backend-check.mjs --link-label "Collecte de prospects"
//
// Prérequis : conteneurs de dev démarrés (onir-cms-dev-app-1 / -db-1) et
// backend accessible. Options : --base, --token, --link-label, --timeout,
// --app-container, --db-container, --db-user, --db-name, --finish.

import { execFileSync } from "node:child_process";
import { createDecipheriv } from "node:crypto";

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const inline = argv.find((entry) => entry.startsWith(`--${name}=`));
  if (inline !== undefined) return inline.slice(name.length + 3);
  const index = argv.indexOf(`--${name}`);
  if (index >= 0 && argv[index + 1] !== undefined && !argv[index + 1].startsWith("--")) {
    return argv[index + 1];
  }
  return fallback;
};

if (flag("help") || flag("h")) {
  console.log(
    "Usage : node tools/backend-check.mjs [--token <jeton>] [--base http://localhost:3000]\n" +
      "       [--link-label <libellé>] [--timeout 120000] [--finish]\n" +
      "Le jeton est sinon décrypté depuis les conteneurs de dev (docker).",
  );
  process.exit(0);
}

const BASE = (option("base", process.env.CHAT_API_BASE ?? "http://localhost:3000")).replace(
  /\/+$/,
  "",
);
const APP_CONTAINER = option(
  "app-container",
  process.env.CMS_APP_CONTAINER ?? "onir-cms-dev-app-1",
);
const DB_CONTAINER = option("db-container", process.env.CMS_DB_CONTAINER ?? "onir-cms-dev-db-1");
const DB_USER = option("db-user", process.env.CMS_DB_USER ?? "onir_cms");
const DB_NAME = option("db-name", process.env.CMS_DB_NAME ?? "onir_cms");
const LINK_LABEL = option("link-label", process.env.CHAT_LINK_LABEL ?? "");
const TIMEOUT = Number(option("timeout", process.env.CHAT_TIMEOUT ?? "120000"));
const RUN_FINISH = flag("finish");

function docker(args) {
  return execFileSync("docker", args, {
    encoding: "utf8",
    timeout: 30000,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function appEnv(name) {
  try {
    return docker(["exec", APP_CONTAINER, "printenv", name]);
  } catch {
    return "";
  }
}

function query(sql) {
  return docker([
    "exec",
    DB_CONTAINER,
    "psql",
    "-U",
    DB_USER,
    "-d",
    DB_NAME,
    "-tA",
    "-c",
    sql,
  ]);
}

/** Ouvre un secret applicatif scellé (`app_secrets.value_enc`). */
function openAppSecret(key, sealed, masterHex) {
  const [version, ivEncoded, tagEncoded, ciphertextEncoded] = sealed.split(":");
  if (version !== "v1" || !ivEncoded || !tagEncoded || !ciphertextEncoded) {
    throw new Error(`Secret ${key} illisible`);
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(masterHex, "hex"),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAAD(Buffer.from(`onir:app-secret:${key}:v1`, "utf8"));
  decipher.setAuthTag(Buffer.from(tagEncoded, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

/** Ouvre le jeton d'un lien (`chat_links.token_enc`). */
function openLinkToken(payload, keyHex) {
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Jeton de lien illisible");
  const [, ivHex, dataHex, tagHex] = parts;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(keyHex, "hex"),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}

/** Trouve le jeton du lien actif : argument, env, puis base de dev. */
function findToken() {
  const provided = option("token", process.env.CHAT_LINK_TOKEN ?? "").trim();
  if (provided !== "") {
    return { token: provided, source: "jeton fourni (--token / CHAT_LINK_TOKEN)" };
  }

  const master = appEnv("CONFIG_MASTER_KEY");
  let linkKey = "";
  if (master !== "") {
    const sealed = query("select value_enc from app_secrets where key = 'LINK_TOKEN_KEY'");
    if (sealed !== "") linkKey = openAppSecret("LINK_TOKEN_KEY", sealed, master);
  }
  if (linkKey === "") linkKey = appEnv("LINK_TOKEN_KEY");
  if (!/^[0-9a-fA-F]{64}$/.test(linkKey)) {
    throw new Error(
      "LINK_TOKEN_KEY introuvable. Fournissez --token ou vérifiez les conteneurs de dev.",
    );
  }

  const rows = query(
    "select token_enc || E'\\t' || label from chat_links where actif = true and token_enc is not null order by created_at desc",
  )
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "");
  if (rows.length === 0) {
    throw new Error("Aucun lien de chat actif dans la base de dev.");
  }

  const parsed = rows.map((line) => {
    const [tokenEnc, label = ""] = line.split("\t");
    return { tokenEnc, label };
  });
  const chosen =
    LINK_LABEL === ""
      ? parsed[0]
      : parsed.find((entry) => entry.label.toLowerCase().includes(LINK_LABEL.toLowerCase()));
  if (chosen === undefined) {
    throw new Error(`Aucun lien actif ne correspond à « ${LINK_LABEL} ».`);
  }

  return {
    token: openLinkToken(chosen.tokenEnc, linkKey),
    source: `lien « ${chosen.label || "sans libellé"} » (base de dev)`,
  };
}

const checks = [];
function check(label, ok, detail, skipped = false) {
  checks.push({ label, ok: Boolean(ok), detail: detail ?? "", skipped });
}

async function call(path, { method = "POST", body } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let json = null;
    try {
      json = text === "" ? null : JSON.parse(text);
    } catch {
      json = null;
    }
    return { status: response.status, ok: response.ok, json, text, ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

function shorten(value, max = 150) {
  const text = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function printReport() {
  let failed = 0;
  for (const entry of checks) {
    if (entry.skipped) {
      console.log(`• ${entry.label} — ${entry.detail} (ignoré)`);
      continue;
    }
    if (entry.ok) {
      console.log(`✓ ${entry.label}${entry.detail ? ` — ${entry.detail}` : ""}`);
    } else {
      failed += 1;
      console.error(`✗ ${entry.label}${entry.detail ? ` — ${entry.detail}` : ""}`);
    }
  }
  console.log(failed === 0 ? "\n✓ Backend : tous les contrôles passent." : `\n✗ ${failed} contrôle(s) en échec.`);
  return failed;
}

let conversationId = null;
try {
  const { token, source } = findToken();
  console.log(`Backend : ${BASE}`);
  console.log(`Source du lien : ${source}\n`);

  const session = await call("/api/chat/session", {
    body: {
      token,
      surface: "page",
      nom: "Smoke Pop Design",
      email: `pop-smoke-${Date.now()}@example.mg`,
      consentement: true,
      contacts: [{ type: "autre", valeur: "Smoke test template" }],
      loadedAt: Date.now() - 5000,
    },
  });
  conversationId = typeof session.json?.conversationId === "string" ? session.json.conversationId : null;
  check(
    "session",
    session.status === 201 && conversationId !== null,
    session.status === 201
      ? `HTTP ${session.status}, ${session.json?.messages?.length ?? 0} message(s) d'historique`
      : `HTTP ${session.status} — ${session.json?.error ?? session.text.slice(0, 200)}`,
  );

  if (conversationId !== null) {
    console.log(`Conversation : ${conversationId}\n`);

    const chat = await call("/api/chat", {
      body: { conversationId, content: "Bonjour, quels sont vos services ?" },
    });
    const answer = chat.json?.message?.content;
    check(
      "chat (Gemini)",
      chat.status === 200 && typeof answer === "string" && answer.trim() !== "",
      `HTTP ${chat.status}, réponse ${typeof answer === "string" ? answer.length : 0} car.`,
    );
    if (typeof answer === "string" && answer.trim() !== "") {
      console.log(`   ↳ ${shorten(answer)}\n`);
    }

    const state = await call("/api/chat/state", {
      body: { conversationId, content: "Je suis très content, merci beaucoup !" },
    });
    const stateValue = state.json?.state;
    check(
      "state (état du visiteur)",
      state.status === 200 &&
        ["neutral", "content", "triste"].includes(stateValue) &&
        Number.isFinite(Number(state.json?.confidence)),
      `HTTP ${state.status}, state=${stateValue}, confidence=${state.json?.confidence}`,
    );

    const fallback = await call("/api/chat/fallback", {
      body: { conversationId, action: "menu" },
    });
    if (fallback.status === 404) {
      check(
        "fallback (menu de secours)",
        true,
        "désactivé sur ce lien (404)",
        true,
      );
    } else {
      const questions = Array.isArray(fallback.json?.questions)
        ? fallback.json.questions
        : [];
      check(
        "fallback (menu de secours)",
        fallback.status === 200 && questions.length > 0,
        `HTTP ${fallback.status}, ${questions.length} question(s)`,
      );

      if (questions.length > 0) {
        const selected = await call("/api/chat/fallback", {
          body: {
            conversationId,
            action: "select",
            questionId: questions[0].id,
          },
        });
        check(
          "fallback (sélection)",
          selected.status === 200 &&
            typeof selected.json?.message?.content === "string" &&
            selected.json.message.content.trim() !== "",
          `HTTP ${selected.status}, question « ${shorten(questions[0].label, 60)} »`,
        );
      }
    }

    const messages = await call(
      `/api/chat/messages?conversationId=${encodeURIComponent(conversationId)}`,
      { method: "GET" },
    );
    const history = Array.isArray(messages.json?.messages) ? messages.json.messages : [];
    check(
      "messages (historique)",
      messages.status === 200 && history.length >= 2,
      `HTTP ${messages.status}, ${history.length} message(s)`,
    );

    if (RUN_FINISH) {
      const finished = await call("/api/chat/finish", {
        body: { conversationId },
      });
      check(
        "finish",
        finished.status === 201,
        `HTTP ${finished.status}, outcome=${finished.json?.outcome ?? "n/a"}`,
      );
    }
  }
} catch (error) {
  checks.push({
    label: "exécution",
    ok: false,
    detail: error instanceof Error ? error.message : String(error),
  });
} finally {
  const failed = printReport();
  process.exit(failed === 0 ? 0 : 1);
}
