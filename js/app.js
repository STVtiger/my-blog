import { markdownToHtml } from './markdown.js';
import { parseFrontMatter } from './frontmatter.js';
import { initThemeToggle } from './theme.js';

const SITE_TITLE = 'My Blog';
const SLUG_RE = /^[a-z0-9-]+$/;

const app = document.getElementById('app');
let indexCache = null;
let routeId = 0;

/* ---------- 데이터 로드 ---------- */

async function fetchText(url) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.text();
}

async function loadIndex() {
  if (!indexCache) {
    const list = JSON.parse(await fetchText('posts/index.json'));
    if (!Array.isArray(list)) throw new Error('posts/index.json은 배열이어야 합니다.');
    indexCache = list
      .filter((post) => post && SLUG_RE.test(post.slug))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  }
  return indexCache;
}

async function loadPost(slug) {
  if (!SLUG_RE.test(slug)) return null;
  let text;
  try {
    text = await fetchText(`posts/${slug}.md`);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
  const { data, body } = parseFrontMatter(text);
  return { meta: { slug, title: slug, ...data }, html: markdownToHtml(body) };
}

/* ---------- DOM 도우미 ---------- */

function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'text') node.textContent = value;
    else node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.append(child);
  }
  return node;
}

function formatDate(value) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function timeEl(date) {
  return date ? el('time', { datetime: date, text: formatDate(date) }) : null;
}

function backLink() {
  return el('a', { class: 'back-link', href: '#/', text: '← 목록으로' });
}

function setView(nodes, title) {
  app.replaceChildren(...nodes);
  document.title = title ? `${title} · ${SITE_TITLE}` : SITE_TITLE;
  window.scrollTo(0, 0);
  app.focus({ preventScroll: true });
}

/* ---------- 화면 ---------- */

function renderList(posts) {
  const heading = el('h1', { class: 'visually-hidden', text: '글 목록' });
  if (!posts.length) {
    setView([heading, el('p', { class: 'status', text: '아직 글이 없습니다.' })]);
    return;
  }
  const items = posts.map((post) =>
    el('li', { class: 'post-item' }, [
      el('h2', {}, el('a', { href: `#/post/${post.slug}`, text: post.title || post.slug })),
      el('p', { class: 'post-meta' }, timeEl(post.date)),
      post.description ? el('p', { text: post.description }) : null,
    ])
  );
  setView([heading, el('ul', { class: 'post-list' }, items)]);
}

function renderPost({ meta, html }) {
  const tags = [].concat(meta.tags || []).filter(Boolean);
  const tagList = tags.length ? el('ul', { class: 'tags' }, tags.map((tag) => el('li', { text: tag }))) : null;

  const content = el('div', { class: 'prose' });
  content.innerHTML = html; // markdownToHtml이 이스케이프를 마친 결과

  const article = el('article', {}, [
    el('header', { class: 'post-header' }, [
      el('h1', { text: meta.title }),
      el('p', { class: 'post-meta' }, [timeEl(meta.date), tagList]),
    ]),
    content,
  ]);
  setView([article, backLink()], meta.title);
}

function renderNotFound() {
  setView(
    [
      el('h1', { text: '글을 찾을 수 없습니다' }),
      el('p', { class: 'status', text: '주소가 바뀌었거나 삭제된 글일 수 있어요.' }),
      backLink(),
    ],
    '찾을 수 없음'
  );
}

function renderError(message) {
  setView([el('p', { class: 'status', text: message }), backLink()], '오류');
}

/* ---------- 라우팅 ---------- */

function parseRoute() {
  const path = location.hash.replace(/^#/, '') || '/';
  if (path === '/') return { name: 'list' };
  const match = path.match(/^\/post\/([^/?#]+)\/?$/);
  if (match) {
    try {
      return { name: 'post', slug: decodeURIComponent(match[1]) };
    } catch {
      return { name: 'notFound' };
    }
  }
  return { name: 'notFound' };
}

async function route() {
  const id = ++routeId;
  const current = parseRoute();
  const loadingTimer = setTimeout(() => {
    if (id === routeId) app.replaceChildren(el('p', { class: 'status', text: '불러오는 중…' }));
  }, 150);

  try {
    if (current.name === 'list') {
      const posts = await loadIndex();
      if (id === routeId) renderList(posts);
    } else if (current.name === 'post') {
      const post = await loadPost(current.slug);
      if (id !== routeId) return;
      if (post) renderPost(post);
      else renderNotFound();
    } else {
      renderNotFound();
    }
  } catch (error) {
    console.error(error);
    if (id === routeId) renderError('글을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
  } finally {
    clearTimeout(loadingTimer);
  }
}

/* ---------- 시작 ---------- */

initThemeToggle(document.querySelector('.theme-toggle'));
document.getElementById('year').textContent = new Date().getFullYear();
window.addEventListener('hashchange', route);
route();
