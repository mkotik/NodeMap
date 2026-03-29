# Design System Document

## 1. Overview & Creative North Star: "NodeMap.io"

This design system is built to facilitate the visualization of complex, non-linear thought. We move away from the "static document" feel of traditional chat apps toward an environment that feels like a digital nervous system.

**The Creative North Star: NodeMap.io.**
This system rejects the rigid, boxy constraints of traditional SaaS. Instead, it embraces a high-end editorial feel where content is suspended in a deep, atmospheric void. We achieve this through "Organic Minimalism"—combining the precision of a high-tech IDE (like Vercel or Linear) with the fluid, curving growth of natural systems. By using intentional asymmetry and depth, we ensure the UI feels like a premium tool for thinkers, not just another chat interface.

---

### 2. Colors & Surface Philosophy

The palette is anchored in a "Deep Space" foundation, allowing the vibrant AI "branch" colors to feel like light sources rather than flat UI elements.

- **Foundation:** The `surface` (`#060e20`) acts as our infinite canvas.
- **The "No-Line" Rule:** Standard 1px borders are strictly prohibited for sectioning. Structural boundaries must be defined through background shifts—specifically moving from `surface` to `surface_container_low` (`#091328`) or `surface_container` (`#0f1930`).
- **Surface Hierarchy & Nesting:** Use "Atmospheric Stacking." A primary chat node sits on `surface_container_high` (`#141f38`), while its parent thread resides on `surface_container`. This creates a sense of physical recession without using heavy shadows.
- **The "Glass & Gradient" Rule:** Floating panels (like sidebars or inspectors) must use a semi-transparent `surface_container` with a `24px` backdrop-blur.
- **Branching Accents:**
- **Primary Path:** `primary` (`#69f6b8`) - Emerald Green.
- **Alternative Path A:** `secondary` (`#699cff`) - Electric Blue.
- **Alternative Path B:** `tertiary` (`#ac8aff`) - Violet.

---

### 3. Typography: Editorial Precision

Our typography scale balances the technical clarity of Inter with the sophisticated, wide-stance authority of Manrope for high-level headlines.

- **Display & Headlines (Manrope):** Use `display-lg` through `headline-sm` for thread titles and major "node" headers. The slightly geometric nature of Manrope provides a "tech-premium" feel.
- **The Body & Interface (Inter):** All chat bubbles, input fields, and labels use Inter.
- **Primary AI Response:** `body-lg` (1rem) for high readability.
- **User Input:** `body-md` (0.875rem) to differentiate from the AI's "authoritative" output.
- **Intentional Asymmetry:** Align thread titles to the left but allow metadata (labels) to sit in wide, airy margins using `label-sm` and `outline` colors to maintain a clean, "blueprint" aesthetic.

---

### 4. Elevation & Depth: Tonal Layering

We do not "drop" shadows; we create "ambient glows."

- **The Layering Principle:** Depth is achieved by stacking. A card should never have a border; it should simply be one step higher on the `surface-container` scale than its parent.
- **Ambient Shadows:** For floating modals, use a shadow with a `48px` blur and 6% opacity, using the `on_surface` color (`#dee5ff`) as the shadow tint. This mimics light refracting through glass rather than a dark void.
- **The "Ghost Border" Fallback:** If a divider is required for accessibility, use the `outline_variant` token at `15%` opacity. It should be felt, not seen.
- **Branch Connections:** Lines connecting nodes must use the `outline` token (`#6d758c`) with a `0.5px` width, employing a `cubic-bezier` curve to feel organic.

---

### 5. Components

#### 5.1. Chat Nodes (Cards)

- **Style:** No borders. Background: `surface_container_low`.
- **Rounding:** `md` (0.375rem) for a crisp, professional edge.
- **Interaction:** On hover, shift to `surface_container_highest` and increase the "node point" glow using the branch color (e.g., `primary_dim`).

#### 5.2. Branching Buttons

- **Primary:** Background: `primary_container`. Text: `on_primary_container`. Use for "Generate New Path."
- **Ghost (Secondary):** No background. `outline` border at 20% opacity. Text: `primary`. Use for "Minor Edit."

#### 5.3. Node Connectors (The "Tree")

- **Visual:** Curved paths (SVG) connecting nodes.
- **State:** When a path is active, the connector line should animate a gradient stroke from `primary_dim` to `primary`.

#### 5.4. Input Fields

- **Style:** Minimalist. No background. A single `outline_variant` "Ghost Border" at the bottom only.
- **Focus State:** The bottom border transforms into a `primary` glow, and the background subtly shifts to `surface_container_lowest`.

#### 5.5. The "Node Point" (Custom Component)

- A small 8px circle that sits at the start/end of every branch.
- **Active:** `box-shadow: 0 0 12px` using the path's specific branch color.

---

### 6. Do’s and Don’ts

#### **Do:**

- **Do** use white space as a structural element. If two nodes feel too close, increase the spacing to `16` (4rem) rather than adding a divider.
- **Do** use smooth transitions (`300ms ease-in-out`) for all surface color shifts.
- **Do** ensure that curved branch lines have a "natural" flow—avoid sharp 90-degree angles.

#### **Don't:**

- **Don't** use 100% black (`#000000`) for anything other than `surface_container_lowest`. The "deep slate" feel must be maintained.
- **Don't** use standard "Material Design" shadows. They are too heavy and break the minimalist, tech-focused aesthetic.
- **Don't** use more than three branch colors in a single view to avoid visual cognitive load. Stick to the hierarchy: Primary (Green) for the main path, Secondary (Blue/Violet) for alternatives.

## Component Rules

- Do NOT create new component files unless explicitly asked
- Modify existing components in place
- If you think a new component is needed, ask first before creating it

## Stack

- Next.js App Router
- tRPC (client in `src/lib/trpc.ts`, server in `src/server/trpc.ts`, routers in `src/server/routers/`)
- Prisma ORM (schema in `prisma/`, client in `src/server/lib/prisma.ts`)
- PostgreSQL (via `@prisma/adapter-pg`)
- JWT auth with access/refresh tokens

## API

- All API routes live in app/api/
- Do not create separate backend files

## General

- Do not install new packages without asking
- Do not refactor working code unless asked
