// Rendu Markdown sûr, sans `dangerouslySetInnerHTML`.
//
// Le backend LLM renvoie souvent du Markdown (gras, listes, liens, blocs de
// code, tableaux). On le rend en nœuds React : aucun HTML brut n'est injecté,
// et seuls les liens http(s)/mailto sont transformés en ancres.

import { Fragment } from "react";

const INLINE_TOKEN =
  /(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(__[^_\n]+__)|(~~[^~\n]+~~)|(\*[^*\n]+\*)|(_[^_\n]+_)|(\[[^\]\n]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))|(<(?:https?:\/\/|mailto:)[^>\s]+>)/;

const BARE_URL = /(?:https?:\/\/|mailto:)[^\s<>()[\]{}"']+/;

/**
 * `renderInline` est récursif (gras → italique → lien). Un regex global
 * partagé conserverait son `lastIndex` d'un appel imbriqué à l'autre et
 * rejouerait le même jeton à l'infini : chaque niveau utilise donc sa propre
 * instance.
 */
function matcher(pattern) {
  return new RegExp(pattern.source, "g");
}

function safeHref(value) {
  const url = String(value ?? "").trim();
  if (!/^(https?:\/\/|mailto:)/i.test(url)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:" && parsed.protocol !== "mailto:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
}

/** Rend un texte brut, en transformant les URL nues en liens. */
function renderPlain(text, keyPrefix) {
  if (text === "") return null;
  const nodes = [];
  let cursor = 0;
  let match;
  let index = 0;
  const bareUrl = matcher(BARE_URL);
  while ((match = bareUrl.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const raw = match[0];
    const trailing = raw.match(/[.,;:!?]+$/)?.[0] ?? "";
    const candidate = trailing === "" ? raw : raw.slice(0, -trailing.length);
    const href = safeHref(candidate);
    const key = `${keyPrefix}-url-${index}`;
    if (href === null) {
      nodes.push(candidate);
    } else {
      nodes.push(
        <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
          {candidate}
        </a>,
      );
    }
    if (trailing !== "") nodes.push(trailing);
    cursor = match.index + raw.length;
    index += 1;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length === 0 ? null : nodes;
}

/** Rend une ligne inline (gras, italique, code, liens, rayé). */
function renderInline(text, keyPrefix = "i") {
  if (typeof text !== "string" || text === "") return null;
  const nodes = [];
  let cursor = 0;
  let match;
  let index = 0;
  const inlineToken = matcher(INLINE_TOKEN);
  while ((match = inlineToken.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(
        <Fragment key={`${keyPrefix}-t-${index}`}>
          {renderPlain(text.slice(cursor, match.index), `${keyPrefix}-${index}`)}
        </Fragment>,
      );
    }
    const token = match[0];
    const key = `${keyPrefix}-m-${index}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key} className="md-code">{token.slice(1, -1)}</code>);
    } else if (/^\*\*[\s\S]+\*\*$/.test(token) || /^__[\s\S]+__$/.test(token)) {
      nodes.push(<strong key={key}>{renderInline(token.slice(2, -2), `${key}-b`)}</strong>);
    } else if (/^~~[\s\S]+~~$/.test(token)) {
      nodes.push(<s key={key}>{renderInline(token.slice(2, -2), `${key}-s`)}</s>);
    } else if (/^\*[\s\S]+\*$/.test(token) || /^_[\s\S]+_$/.test(token)) {
      nodes.push(<em key={key}>{renderInline(token.slice(1, -1), `${key}-e`)}</em>);
    } else if (token.startsWith("[")) {
      const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(token);
      const href = link === null ? null : safeHref(link[2]);
      if (link !== null && href !== null) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(link[1], `${key}-l`)}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else if (token.startsWith("<")) {
      const href = safeHref(token.slice(1, -1));
      if (href !== null) {
        nodes.push(
          <a key={key} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {token.slice(1, -1)}
          </a>,
        );
      } else {
        nodes.push(token);
      }
    } else {
      nodes.push(token);
    }
    cursor = match.index + token.length;
    index += 1;
  }
  if (cursor < text.length) {
    nodes.push(
      <Fragment key={`${keyPrefix}-tail`}>{renderPlain(text.slice(cursor), `${keyPrefix}-tail`)}</Fragment>,
    );
  }
  return nodes;
}

function renderWithBreaks(text, keyPrefix) {
  const lines = String(text ?? "").split("\n");
  return lines.map((line, index) => (
    <Fragment key={`${keyPrefix}-line-${index}`}>
      {index > 0 ? <br /> : null}
      {renderInline(line, `${keyPrefix}-${index}`)}
    </Fragment>
  ));
}

function isTableSeparator(line) {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function splitRow(line) {
  return String(line)
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isFence(line) {
  return /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/.test(line);
}

function isBlockStart(lines, index) {
  const line = lines[index];
  if (line === undefined) return true;
  if (line.trim() === "") return true;
  if (isFence(line)) return true;
  if (/^(#{1,6})\s+/.test(line)) return true;
  if (/^\s*>/.test(line)) return true;
  if (/^\s*[-*+]\s+/.test(line)) return true;
  if (/^\s*\d{1,3}[.)]\s+/.test(line)) return true;
  if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return true;
  if (line.includes("|") && isTableSeparator(lines[index + 1] ?? "")) return true;
  return false;
}

function parseBlocks(source) {
  const lines = String(source ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }

    const fence = /^\s*(`{3,}|~{3,})\s*([\w+-]*)\s*$/.exec(line);
    if (fence !== null) {
      const marker = fence[1][0];
      const length = fence[1].length;
      const language = fence[2];
      const buffer = [];
      i += 1;
      const closing = new RegExp(`^\\s*${marker}{${length},}\\s*$`);
      while (i < lines.length && !closing.test(lines[i])) {
        buffer.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push({ type: "code", language, text: buffer.join("\n") });
      continue;
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading !== null) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2].trim() });
      i += 1;
      continue;
    }

    if (/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push({ type: "hr" });
      i += 1;
      continue;
    }

    if (/^\s*>/.test(line)) {
      const buffer = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buffer.push(lines[i].replace(/^\s*>\s?/, ""));
        i += 1;
      }
      blocks.push({ type: "quote", text: buffer.join("\n") });
      continue;
    }

    if (line.includes("|") && isTableSeparator(lines[i + 1] ?? "")) {
      const header = splitRow(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i += 1;
      }
      blocks.push({ type: "table", header, rows });
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.*)$/.exec(line);
    const ordered = /^\s*\d{1,3}[.)]\s+(.*)$/.exec(line);
    if (unordered !== null || ordered !== null) {
      const isOrdered = ordered !== null;
      const pattern = isOrdered ? /^\s*\d{1,3}[.)]\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      const items = [];
      while (i < lines.length) {
        const item = pattern.exec(lines[i]);
        if (item === null) break;
        items.push(item[1]);
        i += 1;
      }
      blocks.push({ type: "list", ordered: isOrdered, items });
      continue;
    }

    const buffer = [];
    while (i < lines.length && !isBlockStart(lines, i)) {
      buffer.push(lines[i]);
      i += 1;
    }
    if (buffer.length === 0) {
      // Sécurité : une ligne qui ressemble à un bloc inconnu ne bloque pas.
      buffer.push(lines[i]);
      i += 1;
    }
    blocks.push({ type: "paragraph", text: buffer.join("\n") });
  }
  return blocks;
}

function renderBlocks(blocks, prefix) {
  return blocks.map((block, index) => {
    const key = `${prefix}-b-${index}`;
    switch (block.type) {
      case "heading": {
        const Tag = `h${Math.min(6, Math.max(1, block.level))}`;
        return (
          <Tag key={key} className="md-heading">
            {renderInline(block.text, key)}
          </Tag>
        );
      }
      case "code":
        return (
          <pre key={key} className="md-pre">
            <code className={block.language ? `language-${block.language}` : undefined}>{block.text}</code>
          </pre>
        );
      case "quote":
        return (
          <blockquote key={key} className="md-quote">
            {renderBlocks(parseBlocks(block.text), key)}
          </blockquote>
        );
      case "list": {
        const Tag = block.ordered ? "ol" : "ul";
        return (
          <Tag key={key} className="md-list">
            {block.items.map((item, itemIndex) => (
              <li key={`${key}-li-${itemIndex}`}>{renderInline(item, `${key}-li-${itemIndex}`)}</li>
            ))}
          </Tag>
        );
      }
      case "table": {
        return (
          <div key={key} className="md-table">
            <table>
              <thead>
                <tr>
                  {block.header.map((cell, cellIndex) => (
                    <th key={`${key}-th-${cellIndex}`}>{renderInline(cell, `${key}-th-${cellIndex}`)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, rowIndex) => (
                  <tr key={`${key}-tr-${rowIndex}`}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${key}-td-${rowIndex}-${cellIndex}`}>
                        {renderInline(cell, `${key}-td-${rowIndex}-${cellIndex}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
      case "hr":
        return <hr key={key} className="md-hr" />;
      case "paragraph":
      default:
        return (
          <p key={key} className="md-p">
            {renderWithBreaks(block.text, key)}
          </p>
        );
    }
  });
}

/** Composant Markdown : `enabled=false` conserve les retours à la ligne bruts. */
export function Markdown({ text, className = "", enabled = true }) {
  const source = typeof text === "string" ? text : "";
  if (source.trim() === "") return null;
  if (!enabled) return <p className={`md md--plain ${className}`.trim()}>{source}</p>;
  return <div className={`md ${className}`.trim()}>{renderBlocks(parseBlocks(source), "md")}</div>;
}

export { parseBlocks, renderInline };
