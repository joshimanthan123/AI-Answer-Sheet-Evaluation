---
name: Academic Precision System
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#4b41e1'
  on-secondary: '#ffffff'
  secondary-container: '#645efb'
  on-secondary-container: '#fffbff'
  tertiary: '#4d556b'
  on-tertiary: '#ffffff'
  tertiary-container: '#656d84'
  on-tertiary-container: '#eef0ff'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#e2dfff'
  secondary-fixed-dim: '#c3c0ff'
  on-secondary-fixed: '#0f0069'
  on-secondary-fixed-variant: '#3323cc'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.25'
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.4'
    letterSpacing: 0.01em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.2'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 64px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style
The design system is engineered for an AI-driven academic environment, balancing the rigor of education with the efficiency of modern SaaS. The personality is authoritative yet accessible, aiming to reduce the cognitive load of educators through clarity and structural order. 

The visual style follows a **Corporate / Modern** aesthetic with **Glassmorphic** accents for overlays. It prioritizes a high ratio of whitespace to content, ensuring that complex data—like student scores and AI feedback—remains legible and non-intimidating. The emotional response should be one of confidence, reliability, and technological sophistication.

## Colors
The palette is anchored by a deep **Primary Blue** for main actions and an **Indigo** accent for secondary interactive elements and AI-specific features. The background remains a crisp White to maintain an "academic paper" feel, while **Soft Gray** surfaces provide subtle containment for data sections. 

Status colors are calibrated for high legibility against white backgrounds, ensuring that passing grades (Success) and errors in document scanning (Error) are immediately identifiable.

## Typography
This design system utilizes **Inter** exclusively to leverage its exceptional legibility and systematic feel. Headlines use a tighter letter-spacing and heavier weights to establish a clear hierarchy. Body text is set with generous line height to facilitate long-form reading of student answers. Labels and metadata utilize a medium weight and slightly smaller scale to distinguish them from primary content.

## Layout & Spacing
The system employs a **Fluid Grid** model with a 12-column structure for desktop. 
- **Desktop:** 12 columns, 24px gutters, 40px side margins.
- **Tablet:** 8 columns, 16px gutters, 24px side margins.
- **Mobile:** 4 columns, 16px gutters, 16px side margins.

Spacing follows a strict 4px baseline, ensuring all components align vertically. Use `xl` (40px) for section padding and `md` (16px) for internal card padding to maintain a spacious, modern feel.

## Elevation & Depth
Depth is created through a combination of **Ambient Shadows** and **Glassmorphism**. 
- **Base Level:** Flat white background.
- **Card Level:** Very soft, diffused shadow (0px 4px 20px rgba(0, 0, 0, 0.05)) with a 1px border in `#e2e8f0`.
- **Overlay/Modal Level:** Glassmorphism effect utilizing a 12px backdrop blur and 80% opacity white fill.
- **Hover States:** Shadows should subtly deepen and the element should lift (translateY -2px) to provide tactile feedback.

## Shapes
The shape language is contemporary and friendly. Standard UI elements (buttons, inputs) use a **0.5rem (8px)** radius. Primary containers and Answer Sheet preview cards use **rounded-xl (1.5rem / 24px)** to soften the academic environment and align with modern SaaS trends.

## Components
- **Cards:** Use `rounded-xl` with a white background and subtle 1px border. For AI insights, use a light Indigo (`#f5f3ff`) background to distinguish from standard data.
- **Buttons:** Primary buttons are Solid Blue (`#2563eb`) with white text. Secondary buttons use a "Ghost" style with a 1px Indigo border.
- **Status Chips:** Small, pill-shaped indicators for "Evaluated," "Pending," or "Flagged." Use low-saturation background tints (e.g., Light Green for Success) with high-saturation text.
- **Input Fields:** Large tap targets (44px height) with a soft gray border that transitions to Primary Blue on focus. Labels should always sit above the field.
- **Glass Overlays:** Used for "AI Processing" states or "Quick View" answer summaries, ensuring the context of the full document remains visible behind a blur.
- **Progress Steppers:** Horizontal, thin lines using Indigo to indicate the evaluation workflow (Upload -> Scan -> AI Review -> Finalize).