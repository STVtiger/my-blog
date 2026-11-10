---
title: 블로그를 시작합니다
date: 2026-11-10
description: 마크다운 파일만으로 글을 쓰는 작은 블로그를 만들었습니다.
tags: [공지, 블로그]
---

안녕하세요. 이 블로그는 **프레임워크 없이** HTML, CSS, JavaScript만으로 만들었습니다. 글은 모두 마크다운 파일로 씁니다.

## 새 글을 쓰는 방법

1. `posts/` 폴더에 `my-new-post.md` 같은 파일을 만듭니다.
2. 파일 맨 위에 제목과 날짜를 적습니다.
3. `posts/index.json`에 글 정보를 한 줄 추가합니다.

파일 맨 위에는 이렇게 적습니다.

```markdown
---
title: 새 글 제목
date: 2026-11-10
description: 목록에 보일 한 줄 요약
tags: [일상]
---
```

`posts/index.json`에는 이렇게 추가합니다.

```json
{ "slug": "my-new-post", "title": "새 글 제목", "date": "2026-11-10", "description": "목록에 보일 한 줄 요약" }
```

## 미리 보기

로컬에서 확인할 때는 프로젝트 폴더에서 서버를 켜고 `http://localhost:8000`을 엽니다.

```bash
python3 -m http.server 8000
```

> 오른쪽 위의 버튼으로 다크 모드를 켜고 끌 수 있습니다. 선택은 브라우저에 저장됩니다.
