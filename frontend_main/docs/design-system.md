# Design System Documentation

> **RULE:** Every component must use these semantic classes (`bg-primary`, `text-text-primary`, `border-border`, etc.) — never a raw hex, never a default Tailwind color like `bg-blue-600` or `text-gray-700`.

## 1. Color Palette Tokens

All raw hex color values are strictly defined in `app/global.css` under `:root`. No raw hex values are permitted elsewhere in the codebase.

```css
:root {
  --color-background: #FAFAF9;      /* page background, warm off-white */
  --color-surface: #FFFFFF;          /* cards, panels */
  --color-border: #E5E7EB;

  --color-primary: #4338CA;          /* main brand action color */
  --color-primary-hover: #3730A3;
  --color-primary-light: #EEF2FF;    /* tints/backgrounds for primary elements */

  --color-secondary: #0F172A;        /* dark slate, used sparingly for contrast blocks */

  --color-accent: #F59E0B;           /* sparing use — highlights, badges, notices */

  --color-text-primary: #111827;     /* main body/heading text — dark, not pure black */
  --color-text-secondary: #4B5563;   /* muted/secondary text */
  --color-text-on-primary: #FFFFFF;  /* text on top of primary-colored elements */

  --color-success: #16A34A;
  --color-warning: #D97706;
  --color-error: #DC2626;
}
```

## 2. Tailwind Semantic Color Mapping

In `tailwind.config.ts`, theme colors are extended as follows:

| Semantic Token | CSS Variable Pointer | Usage Example |
|---|---|---|
| `background` | `var(--color-background)` | `bg-background` |
| `surface` | `var(--color-surface)` | `bg-surface` |
| `border` | `var(--color-border)` | `border-border` |
| `primary` | `var(--color-primary)` | `bg-primary` |
| `primary-hover` | `var(--color-primary-hover)` | `hover:bg-primary-hover` |
| `primary-light` | `var(--color-primary-light)` | `bg-primary-light` |
| `secondary` | `var(--color-secondary)` | `bg-secondary` |
| `accent` | `var(--color-accent)` | `text-accent` |
| `text-primary` | `var(--color-text-primary)` | `text-text-primary` |
| `text-secondary` | `var(--color-text-secondary)` | `text-text-secondary` |
| `text-on-primary` | `var(--color-text-on-primary)` | `text-text-on-primary` |
| `success` | `var(--color-success)` | `text-success` |
| `warning` | `var(--color-warning)` | `text-warning` |
| `error` | `var(--color-error)` | `text-error` |

## 3. Typography Rules

Exactly two Google Fonts are used across the application:

1. **Heading Font**: `Plus Jakarta Sans` (weights: 600, 700)
   - Applied via `next/font/google` in `app/layout.tsx`
   - Applied to h1–h6 using the `font-heading` Tailwind utility class.
   - Scale: h1 ~32px (`text-3xl`), h2 ~24px (`text-2xl`), h3 ~20px (`text-xl`). Restrained, non-oversized decorative type.

2. **Body Font**: `Inter` (weights: 400, 500)
   - Applied via `next/font/google` in `app/layout.tsx`
   - Default font set on `<body>` with class `font-sans`.
   - Base body text size: 16px minimum (`text-base`), line-height 1.6 (`leading-relaxed`).

3. **Whitespace**: Generous padding on cards and section layouts by default.

## 4. Visual Assets & Icons

- **Hero Backdrop**: The marketing page hero uses the `/assets/hero_backdrop.png` asset.
  - On desktop: cover-fills full container backdrop (`inset-0 object-cover`).
  - On mobile: bottom-right corner aligned (`bottom-0 right-0 object-contain w-3/5 h-1/2`).
- **Icons**: General Lucide icons are encouraged. However, the `sparkles` icon is strictly prohibited in favor of minimal upload/system line icons like `UploadCloud` or `Layers`.

