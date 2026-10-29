# GitHub Actions — Secrets (bidigo-frontend)

Dodaj w: **GitHub → jkielczykowski/bidigo-frontend → Settings → Secrets and variables → Actions → New repository secret**

Workflow `.github/workflows/deploy.yml`: build + lint → deploy na serwer testowy (kontener `bidigo-frontend`)
→ testy dymne strony. Testy E2E z `bidigo-backend`: na pull requestach i przy ręcznym uruchomieniu z `e2e`.

**Cele wdrożenia.** Serwer, użytkownik SSH, port i adres publiczny są w `deploy/targets/<cel>.env` (w repo,
bez sekretów). Joby `deploy`/`smoke` działają w środowisku GitHuba o nazwie celu (`test` przy pushu, wybór
przy ręcznym uruchomieniu). Sekrety repozytorium poniżej służą serwerowi testowemu; środowisko
`production` ma własne — patrz `bidigo-backend/docs/NOWY-SERWER.md`.

Lokalnie te same wartości trzymasz w `.env` (wzór: `.env.example`) — nigdy w gicie.

| Secret | Wymagany | Skąd wziąć |
|--------|----------|------------|
| `VITE_SUPABASE_URL` | tak | `https://<REF>.supabase.co` |
| `VITE_TURNSTILE_SITE_KEY` | nie | Cloudflare Turnstile → site key (publiczny). Pusty/brak = rejestracja bez captchy. Włączając, włącz też CAPTCHA w Supabase (Authentication → Attack Protection) |
| `VITE_SUPABASE_ANON_KEY` | tak | Supabase → Project Settings → API → anon / publishable key (publiczny, trafia do przeglądarki) |
| `VPS_SSH_KEY` | tak | **cały** prywatny klucz SSH do VPS (multiline), bez passphrase |
| `BACKEND_DEPLOY_KEY` | tak | prywatna część klucza wdrożeniowego (deploy key, tylko odczyt) repo `bidigo-backend` — testy E2E są w backendzie. Ustawia go `bash scripts/backend-deploy-key.sh` |

Backend (baza, migracje, wyszukiwarka, maile) wdraża się z `bidigo-backend`. nginx tego repo przekazuje
`/api/search/` do kontenera `bidigo-search` z backendu (sieć Docker `apps-net`).
