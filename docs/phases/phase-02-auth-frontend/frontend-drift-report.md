---
kind: drift-report
phase: phase-02-auth-frontend
plan_mtime: "2026-08-22T12:13:48-03:00"
---

# phase-02-auth-frontend — Drift Report

## Screen: signup — audited at SI-02.15.0 (2026-08-22)

**Quick scan:** 7 alinhado · 1 drift menor · 3 drift relevante · 2 ausente

- BrandLogo (`brand-logo.tsx`) → `alinhado`
- FormLabel (`form-label.tsx`) → `alinhado`
- TextField (`text-field.tsx`) → `drift relevante` (2 changes)
- Button (`button.tsx`) → `alinhado`
- AuthFooter (`auth-footer.tsx`) → `alinhado`
- Card (`card.tsx`) → `drift relevante` (4 changes)
- IconButton (`icon-button.tsx`) → `alinhado`
- EyeIcon (`eye.tsx`) → `alinhado`
- ArrowBackIcon (`arrow-back.tsx`) → `alinhado`
- ProgressLinear (`progress-linear.tsx`) → `drift menor`
- Checkbox (`checkbox.tsx`) → `drift relevante` (5 changes)
- SignupForm (`signup-form.tsx`) → `componente ausente` (create)
- SignupSuccessPanel (`signup-success-panel.tsx`) → `componente ausente` (create)

### next-frontend/components/brand-logo.tsx — BrandLogo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/form-label.tsx — FormLabel

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/text-field.tsx — TextField

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - +slot 'Trailing icon' from Figma demand
  - retune min-width: default — (none) → min-w-[200px]
- **Prior:** _(none)_

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/auth-footer.tsx — AuthFooter

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune radius: default — rounded-xl → rounded-2
  - retune border: default — ring-1 ring-foreground/10 → border border-border
  - retune min-width: default — (none) → min-w-[280px]
  - retune variant override: *:[img:first-child]:rounded-t-xl / *:[img:last-child]:rounded-b-xl → rounded-t-2 / rounded-b-2
- **Prior:** _(none)_

### next-frontend/components/ui/icon-button.tsx — IconButton

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/eye.tsx — EyeIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/icons/arrow-back.tsx — ArrowBackIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** _(none)_

### next-frontend/components/ui/progress-linear.tsx — ProgressLinear

- **Status:** drift menor
- **Decision:** `auto-Edit`
  - retune height: default — h-1 → h-3 wrapper com a barra de 4px centrada (Figma 143:2446: wrapper 12px, Track/Indicator h-4px em top-4px)
- **Prior:** _(none)_

### next-frontend/components/ui/checkbox.tsx — Checkbox

- **Status:** drift relevante
- **Decision:** `auto-Edit`
  - retune border-color: default — border-input → border-border
  - retune border-width: default — border → border-2
  - retune radius: default — rounded-[4px] → rounded-[var(--radius-0-5)]
  - retune variant override: group-has-[:focus-visible]/field-label:not-data-checked:border-input → border-border
  - retune variant override: dark:bg — bg-input/30 → (none)
- **Prior:** _(none)_

### next-frontend/components/signup-form.tsx — SignupForm

- **Status:** componente ausente
- **Decision:** `create`
  - source: from Figma node 143:2399 (frame "Login" do nó 140:333 — composição do formulário de cadastro)
- **Prior:** _(none)_

### next-frontend/components/signup-success-panel.tsx — SignupSuccessPanel

- **Status:** componente ausente
- **Decision:** `create`
  - source: sem nó no Figma — estado de sucesso definido por `auth-frontend/TD-09` (Option A); composto a partir de Card + Button + AuthFooter
- **Prior:** _(none)_

## Screen: login — audited at SI-02.16.0 (2026-08-22)

**Quick scan:** 5 alinhado · 1 drift menor · 0 drift relevante · 1 ausente

- BrandLogo (`brand-logo.tsx`) → `alinhado`
- FormLabel (`form-label.tsx`) → `alinhado`
- TextField (`text-field.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`
- AuthFooter (`auth-footer.tsx`) → `alinhado`
- Card (`card.tsx`) → `drift menor` (exception)
- LoginForm (`login-form.tsx`) → `componente ausente` (create)

### next-frontend/components/brand-logo.tsx — BrandLogo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/form-label.tsx — FormLabel

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/text-field.tsx — TextField

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (slot 'Trailing icon' + min-w-[200px]) at SI-02.15.0 honored"

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/auth-footer.tsx — AuthFooter

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: das quatro dimensões decididas em SI-02.15.0, três (radius, border, radius das imagens) seguem no arquivo e batem com o nó `143:1250`; só `min-w-[280px]` saiu da base — a limpeza de SI-02.15b a moveu para o call site por ser restrição de composição, não do primitive. O nó de login pede o mesmo valor no mesmo lugar, então reinstalar na base duplicaria a restrição em vez de corrigir drift.
- **Prior:** "auto-Edit (4 changes: radius, border, min-width, radius das imagens) at SI-02.15.0 honored"

### next-frontend/components/login-form.tsx — LoginForm

- **Status:** componente ausente
- **Decision:** `create`
  - source: from Figma node 143:2265 (frame "Login" do nó 138:179 — composição do formulário de login)
- **Prior:** _(none)_

## Screen: forgot-password — audited at SI-02.17.0 (2026-08-22)

**Quick scan:** 6 alinhado · 1 drift menor · 0 drift relevante · 1 ausente

- BrandLogo (`brand-logo.tsx`) → `alinhado`
- FormLabel (`form-label.tsx`) → `alinhado`
- TextField (`text-field.tsx`) → `alinhado`
- Button (`button.tsx`) → `alinhado`
- AuthFooter (`auth-footer.tsx`) → `alinhado`
- Card (`card.tsx`) → `drift menor` (exception)
- ArrowBackIcon (`arrow-back.tsx`) → `alinhado`
- ForgotPasswordForm (`forgot-password-form.tsx`) → `componente ausente` (create)

### next-frontend/components/brand-logo.tsx — BrandLogo

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/form-label.tsx — FormLabel

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/text-field.tsx — TextField

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "auto-Edit (slot 'Trailing icon' + min-w-[200px]) at SI-02.15.0 honored"

### next-frontend/components/ui/button.tsx — Button

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/auth-footer.tsx — AuthFooter

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/ui/card.tsx — Card

- **Status:** drift menor
- **Decision:** `exception`
  - reason: mesma situação de `## Screen: login` — radius, border e radius das imagens seguem no arquivo e batem com o nó `143:2308`; só `min-w-[280px]` vive no call site desde a limpeza de SI-02.15b, por ser restrição de composição. Reinstalar na base duplicaria a restrição.
- **Prior:** "exception (min-width no call site) at SI-02.16.0 honored"

### next-frontend/components/icons/arrow-back.tsx — ArrowBackIcon

- **Status:** alinhado
- **Decision:** `skip`
- **Prior:** "skip at SI-02.15.0 honored"

### next-frontend/components/forgot-password-form.tsx — ForgotPasswordForm

- **Status:** componente ausente
- **Decision:** `create`
  - source: from Figma node 143:2307 (frame "Login" do nó 140:289 — composição da solicitação de redefinição)
- **Prior:** _(none)_
