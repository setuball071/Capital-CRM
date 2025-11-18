# Design Guidelines: Simulador de Portabilidade de Crédito Consignado

## Design Approach: Material Design System (Finance-Optimized)

**Rationale**: Financial calculators require trust, clarity, and efficiency. Material Design provides familiar patterns that communicate professionalism while maintaining excellent usability for data-heavy interfaces.

**Key Principles**:
- Clarity over decoration - every element serves the calculation flow
- Trust through consistency and professional presentation
- Immediate value - calculator accessible without scrolling
- Mobile-first given Brazilian market mobile usage

## Typography System

**Font Family**: 
- Primary: 'Inter' or 'Roboto' from Google Fonts (clean, readable for numbers)
- Monospace: 'Roboto Mono' for currency values and calculations

**Hierarchy**:
- Page Title: text-3xl/text-4xl, font-semibold
- Section Headers: text-xl/text-2xl, font-semibold
- Input Labels: text-sm, font-medium
- Currency Values: text-2xl/text-3xl, font-bold (results), text-lg (inputs)
- Helper Text: text-xs/text-sm, font-normal
- Body Text: text-base

## Layout System

**Spacing Primitives**: Consistent use of Tailwind units: 2, 4, 6, 8, 12, 16
- Input spacing: p-4
- Section gaps: gap-6 to gap-8
- Component padding: p-6 to p-8
- Page margins: px-4 (mobile), px-8 (desktop)

**Container Strategy**:
- Main container: max-w-6xl mx-auto
- Form sections: max-w-2xl for single column, max-w-5xl for comparison view
- Card components: rounded-lg with consistent padding

**Grid Structure**:
- Mobile: Single column stack (grid-cols-1)
- Desktop: Two-column comparison (grid-cols-2) for current vs. new proposal
- Input groups: Vertical stacking with clear labels above inputs

## Component Library

### A. Calculator Interface Layout

**Header Section** (no hero needed - utility-first):
- Compact top bar with logo/title
- Brief tagline explaining tool purpose
- Immediate access to calculator (no scrolling required)

**Input Form Structure**:

*Current Loan Section*:
- Card with clear "Contrato Atual" header
- Three input fields vertically stacked:
  - Saldo Devedor (Outstanding Balance) - Currency input with R$ prefix
  - Taxa de Juros Atual (Current Rate) - Percentage input with % suffix  
  - Prazo Restante (Remaining Term) - Number input with "meses" label
- Input fields: Large touch targets (h-12), clear borders, focus states
- Helper text below each input explaining what to enter

*New Proposal Section*:
- Matching card layout with "Nova Proposta" header
- Two input fields:
  - Nova Taxa de Juros (New Rate) - Percentage input
  - Novo Prazo (New Term) - Number input
- Same input styling for consistency

### B. Results Display

**Comparison Cards** (side-by-side on desktop, stacked on mobile):

*Current Contract Card*:
- Monthly payment (Parcela Atual)
- Total remaining (Total a Pagar)
- Displayed in monospace font for clarity

*New Proposal Card*:
- New monthly payment (Nova Parcela)
- New total amount
- Visual indicator of savings

**Savings Highlight Section**:
- Prominent display card with:
  - Monthly reduction (Redução Mensal): Large text-3xl
  - Percentage savings: text-lg
  - Total savings (Economia Total): text-2xl
- Use subtle background differentiation (handled via styling, not specified here)

### C. Form Elements

**Input Fields**:
- Height: h-12 for comfortable touch targets
- Padding: px-4 py-3
- Border: Defined weight with rounded corners (rounded-md)
- Label positioning: Above input with mb-2 spacing
- Currency/percentage indicators: Inside input as prefix/suffix
- Error states: Border change + helper text below input

**Buttons**:
- Primary CTA ("Calcular" / Calculate): Large size (px-8 py-3), prominent placement
- Secondary actions ("Limpar" / Clear): Smaller, outline style
- Spacing between buttons: gap-4

**Input Validation Indicators**:
- Real-time validation feedback
- Clear error messages in helper text position
- Success indicators for valid inputs

### D. Information Architecture

**Primary Flow**:
1. Page header (compact, informative)
2. Input forms (side-by-side on desktop for easy comparison)
3. Calculate button (centered, prominent)
4. Results display (immediate, clear hierarchy)
5. Additional information/disclaimers (compact footer)

**Footer Section**:
- Legal disclaimers (small text)
- Brief explanation of calculation method
- Contact or additional resources
- Compact, not visually dominant

## Responsive Behavior

**Mobile (< 768px)**:
- Single column layout
- Input sections stack vertically
- Results cards stack vertically
- Maintain comfortable spacing (py-6 between sections)
- Full-width inputs for easy mobile typing

**Desktop (≥ 768px)**:
- Two-column layout for current vs. new proposal
- Side-by-side comparison for results
- Centered container with ample whitespace
- Maximum width constraints for readability

## Accessibility

- High contrast ratios for all text (4.5:1 minimum)
- Large touch targets (minimum 44x44px)
- Clear focus indicators on all interactive elements
- ARIA labels for currency inputs
- Keyboard navigation support
- Screen reader friendly currency formatting

## Images

**No hero image needed** - This is a utility-focused calculator where immediate access to functionality is paramount. Visual elements should support usability, not decoration.

**Supporting Graphics** (if needed):
- Small icon in header (calculator or money symbol) - 24x24px
- Visual indicators for savings (checkmark icon) - 20x20px
- Use icons from Material Icons or Heroicons library

## Special Considerations

**Brazilian Currency Formatting**:
- Display: R$ 1.234,56 (period for thousands, comma for decimals)
- Large, readable monospace font for all currency values
- Consistent decimal places (always 2 digits)

**Number Input UX**:
- Percentage inputs: Allow decimal entry (e.g., 2.49%)
- Currency masks for real-time formatting
- Clear placeholder examples in each field

**Calculation Transparency**:
- Brief explanation of formula used (Price/SAC system)
- Disclaimer about estimate nature
- Clear labeling of all values