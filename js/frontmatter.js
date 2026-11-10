// 글 맨 위의 front matter(--- 사이의 key: value)를 읽는다.

function unquote(value) {
  const match = value.match(/^(['"])(.*)\1$/);
  return match ? match[2] : value;
}

function parseValue(raw) {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => unquote(item.trim()))
      .filter(Boolean);
  }
  return unquote(value);
}

export function parseFrontMatter(text) {
  const source = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const lines = source.split('\n');

  if (lines[0].trim() !== '---') {
    return { data: {}, body: source };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (end === -1) {
    return { data: {}, body: source };
  }

  const data = {};
  for (const line of lines.slice(1, end)) {
    const match = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (match) {
      data[match[1]] = parseValue(match[2]);
    }
  }

  return { data, body: lines.slice(end + 1).join('\n') };
}
