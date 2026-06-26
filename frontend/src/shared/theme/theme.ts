/* Design tokens reference.
 *
 * Runtime values are injected by Radix <Theme> component.
 * See https://www.radix-ui.com/themes/docs/theme/overview
 *
 * CSS custom properties available:
 *   --orange-{1..12}, --gray-{1..12}, --red-{1..12}, --green-{1..12}
 *   --space-{1..9}         (1=4px, 2=8px, 3=12px, 4=16px, …)
 *   --radius-{1..6}        (1=4px, 2=6px, 3=8px, …)
 *   --font-size-{1..9}
 *   --font-weight-{regular,medium,bold}
 *   --color-background, --color-text, --color-panel
 */

export const theme = {
  accentColor: 'orange',
  grayColor: 'slate',
  scaling: '100%',
  radius: 'medium',
} as const
