# ACIS Version 5.0 Icon Audit Report

## Overview

This report documents all current icon locations in the Tenant App and proposes a roadmap for migrating to developer-managed, UID-based image icons.

### Audit Results (Remaining Work)

| File path | UI location | Current source | Proposed icon key name | Suggested UID field name | Priority |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `layout/DesktopHeader.jsx` | Header: Theme (Sun/Moon) | Lucide (Sun/Moon) | `ui_theme_light`, `ui_theme_dark` | `ui_theme_light_uid` | High |
| `layout/DesktopHeader.jsx` | Action: Quick View | Lucide (Eye) | `ui_action_view` | `ui_action_view_uid` | Medium |
| `layout/DesktopHeader.jsx` | Action: Delete/Reject | Lucide (Trash) | `ui_action_delete` | `ui_action_delete_uid` | Medium |
| `layout/DesktopHeader.jsx` | Action: Confirm/Approve | Lucide (Check) | `ui_action_confirm` | `ui_action_confirm_uid` | Medium |
| `layout/DesktopHeader.jsx` | Action: Restore/Retrieve | Lucide (RotateCcw) | `ui_action_restore` | `ui_action_restore_uid` | Medium |
| `layout/TitleBar.jsx` | Window Layout Switcher | Lucide (Layout) | `ui_layout_switcher` | `ui_layout_switcher_uid` | Medium |
| `chat/ChatAssistantPanel.jsx` | Guide Prompt Icon | Lucide / Emoji | `ui_chat_guide` | `ui_chat_guide_uid` | Low |
| `layout/TitleBar.jsx` | Window Controls | Lucide | `ui_win_controls` | `ui_win_controls_uid` | Low |

## Status: Already Integrated / Settled

The following icons are already mapped to `acis_system_assets` (UID-based resolution at runtime) and are considered **Done**:

- **Sidebar Navigation**: Dashboard (Home), Clients, dailyTransactions, tasksTracking, quotations, proformaInvoices, receivePayments, invoiceManagement, operationExpenses, portalManagement, documentCalendar.
- **Sidebar Utilities**: Settings (`icon_page_settings`), Recycle Bin (`icon_page_recycle_bin`), Toggle (`icon_ui_sidebar_toggle`).
- **Header Utilities**: Search (`icon_ui_search`), Notifications (`icon_ui_bell`).
- **Identity Documents**: Emirates ID (`icon_doc_emirates_id`), Passport (`icon_doc_passport`), Unified Number (`icon_doc_unified`), Person Code (`icon_doc_person_code`), Work Permit (`icon_doc_work_permit`).
- **Transaction Methods**: Cash, Bank Transfer, Online Payment, CDM, Cheque, Tabby, Tamara.
- **Bot Assistant**: Avatar (`icon_bot_uid`) - **Integrated**. User will upload image in Developer Portal.
- **Header Logo**: Settled. Uses the **Tenant Logo** directly as the header icon.
- **Footer Watermark**: Settled. Controlled via Platform Settings (Footer Icon).
- **Dirham Icon**: Settled. Uses the Local Static SVG (`DirhamIcon.jsx`) and will not be changed.

## Asset Specification (Requirements)

1. **Bot Assistant Avatar**: Recommend **128x128px** (1:1 Ratio, Cropped Circle).
2. **Chat Guide Icon**: Recommend **128x128px**.
3. **General System Icons**: All icons uploaded should be transparent PNGs or SVGs at **128x128px** for optimal clarity.

## Migration Strategy

### Phase 4: Seasonal / Universal Variation Switching (Integrated)

1. **Global Toggle**: Added a "System Icon Variation" switch in Developer Portal (`PlatformSettingsPage`) to toggle between `Default`, `Winter`, `Summer`, `Ramadan`, `Eid`, and `Anniversary`.
2. **Variation-Aware Uploads**: Updated `ApplicationLibraryPage` to allow uploading unique icons for each seasonal variation (e.g., `icon_page_dashboard_winter`).
3. **Automatic Resolution**: The Tenant App's `resolveAssetWithVariation` helper now automatically prioritizes the active variation set in the global controller, falling back to the default icon only if the seasonal version isn't found.
4. **Universal Support**: This logic is now active for Sidebar Navigation, Identity Documents, Page Icons, and the Bot Assistant.

### Avoiding UI Breaks

- **Feature Flag / Conditional Loading**: Ensure that if a UID is empty in the registry (as drafting initially), the current Lucide/fallback icon is still rendered.
- **Progressive Migration**: Move one major component at a time (e.g., Sidebar first, then Header, then Fields).

### Theme Compatibility

- **Tinting**: System-managed image icons should ideally be SVGs or high-quality PNGs that can be tinted via CSS `filter` (for light/dark mode) if they are monochrome.
- **Transparency**: All icons must have transparent backgrounds to work with the "Glass" theme.

