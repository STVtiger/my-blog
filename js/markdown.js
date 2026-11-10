// 마크다운 → HTML 변환기 (외부 라이브러리 없이 직접 구현)
//
// 지원: 제목, 문단, 줄바꿈, 굵게/기울임/취소선, 인라인 코드, 링크, 이미지,
//       목록(중첩), 인용문, 코드 블록, 수평선, GFM 표, 백슬래시 이스케이프
// 보안: 원문의 HTML은 모두 이스케이프하고, 링크 URL은 안전한 스킴만 허용한다.

const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
}

// 이미 이스케이프된 URL을 받아, 허용되지 않은 스킴이면 '#'을 돌려준다.
// 이미지에 한해 data:image/ 는 허용한다 (<img> 안에서는 스크립트가 실행되지 않음).
export function safeUrl(url, { image = false } = {}) {
  const normalized = url
    .replace(/&amp;/g, '&')
    .replace(/[\u0000- ]/g, '')
    .toLowerCase();
  const hasScheme = /^[a-z][a-z0-9+.-]*:/.test(normalized);
  if (!hasScheme || /^(https?|mailto):/.test(normalized)) return url;
  if (image && normalized.startsWith('data:image/')) return url;
  return '#';
}

// 괄호 한 단계까지 허용하는 URL 패턴 (예: 위키백과 주소)
const URL_PART = '((?:[^()\\s]|\\([^()\\s]*\\))+)';
const TITLE_PART = '(?:\\s+&quot;(.*?)&quot;)?';
const RE_IMAGE = new RegExp(`!\\[([^\\]]*)\\]\\(${URL_PART}${TITLE_PART}\\)`, 'g');
const RE_LINK = new RegExp(`\\[([^\\]]+)\\]\\(${URL_PART}${TITLE_PART}\\)`, 'g');

/* ---------- 인라인 ---------- */

function emphasis(text) {
  return text
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^\p{L}\p{N}_])__(?=\S)(.+?)(?<=\S)__(?![\p{L}\p{N}_])/gu, '$1<strong>$2</strong>')
    .replace(/\*(?=\S)(.+?)(?<=\S)\*/g, '<em>$1</em>')
    .replace(/(^|[^\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, '$1<em>$2</em>')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '<del>$1</del>');
}

function inline(source) {
  // 이미 HTML로 바꾼 조각은 자리표시자로 빼 두어, 이후 규칙이 건드리지 않게 한다.
  const tokens = [];
  const stash = (html) => `\u0000${tokens.push(html) - 1}\u0000`;

  let text = source
    .replace(/\u0000/g, '')
    .replace(/(`+)(.+?)\1/g, (_, ticks, code) => stash(`<code>${escapeHtml(code.trim())}</code>`))
    .replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, (_, ch) => stash(escapeHtml(ch)));

  text = escapeHtml(text);

  text = text.replace(RE_IMAGE, (_, alt, url, title) => {
    const titleAttr = title ? ` title="${title}"` : '';
    return stash(`<img src="${safeUrl(url, { image: true })}" alt="${alt}"${titleAttr} loading="lazy">`);
  });

  text = text.replace(RE_LINK, (_, label, url, title) => {
    const href = safeUrl(url);
    const titleAttr = title ? ` title="${title}"` : '';
    const external = /^https?:/i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : '';
    return stash(`<a href="${href}"${titleAttr}${external}>${emphasis(label)}</a>`);
  });

  text = emphasis(text);

  // 자리표시자 복원 (링크 안의 코드처럼 중첩될 수 있으므로 반복)
  while (/\u0000\d+\u0000/.test(text)) {
    text = text.replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)]);
  }
  return text;
}

function paragraphText(lines) {
  return lines
    .map((line, index) => {
      const hardBreak = / {2,}$/.test(line) || /(^|[^\\])\\$/.test(line);
      const content = inline(line.replace(/\\$/, '').trim());
      return hardBreak && index < lines.length - 1 ? `${content}<br>` : content;
    })
    .join('\n');
}

/* ---------- 블록 판별 ---------- */

const RE_BLANK = /^\s*$/;
const RE_FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/;
const RE_HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const RE_HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const RE_QUOTE = /^ {0,3}>/;
const RE_LIST_ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const RE_TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function indentOf(spaces) {
  return spaces.replace(/\t/g, '    ').length;
}

function isTableStart(lines, i) {
  return lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && RE_TABLE_SEP.test(lines[i + 1]);
}

function startsBlock(lines, i) {
  const line = lines[i];
  return (
    RE_FENCE.test(line) ||
    RE_HEADING.test(line) ||
    RE_HR.test(line) ||
    RE_QUOTE.test(line) ||
    RE_LIST_ITEM.test(line) ||
    isTableStart(lines, i)
  );
}

/* ---------- 표 ---------- */

function splitRow(line) {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim());
}

function parseTable(lines, start) {
  const headers = splitRow(lines[start]);
  const aligns = splitRow(lines[start + 1]).map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
    if (cell.endsWith(':')) return 'right';
    if (cell.startsWith(':')) return 'left';
    return '';
  });

  const cellHtml = (tag, content, col) => {
    const align = aligns[col] ? ` style="text-align:${aligns[col]}"` : '';
    return `<${tag}${align}>${inline(content || '')}</${tag}>`;
  };

  let i = start + 2;
  const rows = [];
  while (i < lines.length && !RE_BLANK.test(lines[i]) && lines[i].includes('|')) {
    const cells = splitRow(lines[i]);
    rows.push(`<tr>${headers.map((_, col) => cellHtml('td', cells[col], col)).join('')}</tr>`);
    i++;
  }

  const head = `<tr>${headers.map((h, col) => cellHtml('th', h, col)).join('')}</tr>`;
  const body = rows.length ? `<tbody>\n${rows.join('\n')}\n</tbody>` : '';
  return {
    html: `<div class="table-wrap"><table>\n<thead>\n${head}\n</thead>\n${body}\n</table></div>`,
    next: i,
  };
}

/* ---------- 목록 ---------- */

function parseList(lines, start) {
  const first = lines[start].match(RE_LIST_ITEM);
  const baseIndent = indentOf(first[1]);
  const ordered = /\d/.test(first[2]);
  const items = [];
  let i = start;

  while (i < lines.length) {
    const line = lines[i];

    if (RE_BLANK.test(line)) {
      // 빈 줄 다음에 같은 목록의 항목이 이어지면 계속, 아니면 목록 끝
      let j = i + 1;
      while (j < lines.length && RE_BLANK.test(lines[j])) j++;
      const nextItem = j < lines.length && lines[j].match(RE_LIST_ITEM);
      if (nextItem && indentOf(nextItem[1]) >= baseIndent) {
        i = j;
        continue;
      }
      break;
    }

    const match = line.match(RE_LIST_ITEM);
    if (match) {
      const indent = indentOf(match[1]);
      if (indent < baseIndent) break;
      if (indent < baseIndent + 2) {
        if (/\d/.test(match[2]) !== ordered) break;
        items.push({ text: [match[3]], children: [] });
        i++;
        continue;
      }
      if (items.length) {
        const nested = parseList(lines, i);
        items[items.length - 1].children.push(nested.html);
        i = nested.next;
        continue;
      }
    }

    // 항목 본문이 다음 줄로 이어지는 경우
    if (items.length && !match && (/^\s+/.test(line) || !startsBlock(lines, i))) {
      items[items.length - 1].text.push(line.trim());
      i++;
      continue;
    }
    break;
  }

  const tag = ordered ? 'ol' : 'ul';
  const startNum = ordered ? parseInt(first[2], 10) : 1;
  const startAttr = ordered && startNum !== 1 ? ` start="${startNum}"` : '';
  const body = items
    .map((item) => `<li>${paragraphText(item.text)}${item.children.join('')}</li>`)
    .join('\n');
  return { html: `<${tag}${startAttr}>\n${body}\n</${tag}>`, next: i };
}

/* ---------- 블록 ---------- */

function parseBlocks(lines) {
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (RE_BLANK.test(line)) {
      i++;
      continue;
    }

    const fence = line.match(RE_FENCE);
    if (fence) {
      const marker = fence[1];
      const lang = fence[2];
      const code = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        code.push(lines[i]);
        i++;
      }
      i++; // 닫는 펜스
      const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${langAttr}>${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = line.match(RE_HEADING);
    if (heading) {
      const level = heading[1].length;
      out.push(`<h${level}>${inline(heading[2] || '')}</h${level}>`);
      i++;
      continue;
    }

    if (RE_HR.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    if (RE_QUOTE.test(line)) {
      const quoted = [];
      while (i < lines.length && RE_QUOTE.test(lines[i])) {
        quoted.push(lines[i].replace(/^ {0,3}> ?/, ''));
        i++;
      }
      out.push(`<blockquote>\n${parseBlocks(quoted)}\n</blockquote>`);
      continue;
    }

    if (isTableStart(lines, i)) {
      const table = parseTable(lines, i);
      out.push(table.html);
      i = table.next;
      continue;
    }

    if (RE_LIST_ITEM.test(line)) {
      const list = parseList(lines, i);
      out.push(list.html);
      i = list.next;
      continue;
    }

    const paragraph = [];
    do {
      paragraph.push(lines[i]);
      i++;
    } while (i < lines.length && !RE_BLANK.test(lines[i]) && !startsBlock(lines, i));
    out.push(`<p>${paragraphText(paragraph)}</p>`);
  }

  return out.join('\n');
}

export function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n');
  return parseBlocks(lines);
}
