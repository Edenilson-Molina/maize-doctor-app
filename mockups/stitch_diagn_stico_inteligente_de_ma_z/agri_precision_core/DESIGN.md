---
name: Agri-Precision Core
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#414844'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#012d1d'
  on-primary: '#ffffff'
  primary-container: '#1b4332'
  on-primary-container: '#86af99'
  inverse-primary: '#a5d0b9'
  secondary: '#7d562d'
  on-secondary: '#ffffff'
  secondary-container: '#ffca98'
  on-secondary-container: '#7a532a'
  tertiary: '#002d1c'
  on-tertiary: '#ffffff'
  tertiary-container: '#00452e'
  on-tertiary-container: '#75b393'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd4'
  primary-fixed-dim: '#a5d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3d'
  secondary-fixed: '#ffdcbd'
  secondary-fixed-dim: '#f0bd8b'
  on-secondary-fixed: '#2c1600'
  on-secondary-fixed-variant: '#623f18'
  tertiary-fixed: '#b1f0ce'
  tertiary-fixed-dim: '#95d4b3'
  on-tertiary-fixed: '#002114'
  on-tertiary-fixed-variant: '#0e5138'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
  headline-md:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Hanken Grotesk
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: 0.02em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding: 20px
  gutter: 16px
  stack-sm: 12px
  stack-md: 24px
  touch-target: 48px
---

## Brand & Style

The design system is engineered for the intersection of high-technology and field agriculture. The brand personality is **authoritative, resilient, and precise**. It targets agricultural professionals and researchers who require immediate, actionable data in challenging environmental conditions.

The visual style utilizes a **Modern Corporate** approach with a **Tactile** twist—ensuring that digital elements feel substantial and easy to interact with during field use. The UI prioritizes high legibility and clear information architecture to reduce cognitive load. By moving to a **Light Mode** foundation, the system ensures maximum readability under direct sunlight and high-glare outdoor environments common in field operations.

## Colors

The palette is rooted in the "Deep Green" of healthy corn stalks, providing a professional and industry-specific foundation.
- **Primary (#1B4332):** A deep, forest green used for headers, primary actions, and branding to evoke stability and growth.
- **Secondary (#D4A373):** An earthy ochre representing the soil and harvest, used for supporting accents and secondary data points.
- **Status Accents:** High-contrast tokens are reserved for diagnostic results. **Healthy** uses a vibrant emerald, while **Diseased/Pest** alerts use a high-visibility crimson to ensure urgency.
- **Backgrounds:** Utilizing a **Light Mode** scheme, the system employs clean, off-white and light gray neutrals. This provides a crisp, paper-like backdrop that maintains high contrast for text and data visualizations in bright daylight.

## Typography

This design system employs a multi-font strategy to balance character with utility:
- **Hanken Grotesk** (Headlines): Chosen for its sharp, contemporary feel. It provides a technical edge to titles and diagnostic headers.
- **Inter** (Body): Used for all reading-heavy content. Its high x-height ensures legibility on mobile screens, particularly when rendered as dark text on the light background.
- **JetBrains Mono** (Labels/Technical Data): Used for confidence scores, GPS coordinates, and technical metadata. The monospaced nature emphasizes the "Deep Learning" and data-driven aspect of the product.

## Layout & Spacing

The layout utilizes a **8px soft grid** with a fluid 4-column system for mobile devices. 
- **Touch Safety:** All primary actions adhere to a minimum 48px touch target to accommodate users who may be wearing gloves or working in the field.
- **Margins:** A generous 20px side margin prevents content from clipping on modern curved displays and improves focus.
- **Offline Indicators:** A persistent top-bar or corner-badge layout is reserved to show "Local Mode" or "Sync Pending" status using the earthy secondary color.

## Elevation & Depth

To maintain the "Robust/Field" feel in a light environment, depth is conveyed through **Tonal Layers** and subtle shadows.
- **Surface Tiering:** The main background is the lightest tier. Cards housing diagnostic data sit on slightly darker or bordered surface containers to indicate hierarchy.
- **Shadows:** Use soft, natural shadows with low opacity to define boundaries between surfaces without creating "dirty" visuals. Shadows help components pop against the light background.
- **Active States:** Buttons and interactive cards use tonal shifts (darkening the surface slightly) to simulate physical feedback and compression.

## Shapes

The design system uses a **Rounded** (0.5rem) language. This balances the "Technical/Precision" feel of sharp corners with the "Modern/Approachability" of rounded forms. 
- **Primary Buttons:** Utilize the standard 0.5rem (8px) radius.
- **Image Containers:** Captures of corn leaves should use `rounded-lg` (16px) to soften the "tech" and frame the organic subject matter.

## Components

### Buttons & Actions
- **Primary Action (Floating):** The camera/detection button is a large, circular FAB (Floating Action Button) with a high-contrast icon and a subtle 2px Primary border.
- **Secondary Actions:** Outline buttons with a 1.5px stroke weight, using the Primary color or high-contrast On-Surface tokens.

### Cards
- **Diagnostic Cards:** Feature a top-edge color-coded strip (Green/Yellow/Red) to communicate status instantly. They must include a "Confidence Score" label in JetBrains Mono. In Light Mode, card backgrounds use a slightly tinted or bordered surface to stand out from the bright background.

### Inputs & Selection
- **Field Inputs:** Clear, high-contrast borders with 16px internal padding for easy tapping.
- **Status Chips:** Small, solid background pills used for metadata (e.g., "Pest Type: Fall Armyworm") to ensure text remains legible against the white surface.

### Offline Indicators
- **Sync Status:** A dedicated component in the header using a rotating "refresh" icon when active and a "cloud-off" icon when offline, ensuring the user always knows the state of their data.

### Agricultural Metrics
- **Metric Grids:** 2-column small cards for humidity, temperature, and soil moisture, using distinct "Soil Brown" and "Leaf Green" iconography.