// 라이트/다크 테마 토글. 첫 적용은 index.html <head>의 인라인 스크립트가 담당한다.

const STORAGE_KEY = 'theme';

function getStoredTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}

function storeTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // 저장소를 쓸 수 없어도 현재 페이지에서는 동작한다.
  }
}

function applyTheme(theme, button) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  // ︎: 이모지가 아닌 텍스트 글리프로 표시
  button.textContent = isDark ? '☀︎' : '☾︎';
  button.setAttribute('aria-label', isDark ? '라이트 모드로 전환' : '다크 모드로 전환');
}

export function initThemeToggle(button) {
  if (!button) return;

  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  applyTheme(current, button);

  button.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    storeTheme(next);
    applyTheme(next, button);
  });

  // 사용자가 직접 고른 적이 없으면 OS 설정 변경을 따라간다.
  const media = window.matchMedia('(prefers-color-scheme: dark)');
  media.addEventListener('change', (event) => {
    if (!getStoredTheme()) {
      applyTheme(event.matches ? 'dark' : 'light', button);
    }
  });
}
