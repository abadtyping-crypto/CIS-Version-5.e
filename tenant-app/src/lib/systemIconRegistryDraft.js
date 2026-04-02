/**
 * Central registry draft for REMAINING developer-managed image icons.
 * This registry focuses on polishing UI-only icons and action visuals.
 * 
 * Note: Base Navigation, Identity Documents, and Transaction Methods 
 * are already integrated with UID-based resolution in the codebase.
 */
export const SYSTEM_ICON_REGISTRY = {
  // --- UI Theme & Layout ---
  ui_theme_light: { uid: "", note: "header: light mode sun icon" },
  ui_theme_dark: { uid: "", note: "header: dark mode moon icon" },
  ui_layout_switcher: { uid: "", note: "titlebar: layout mode switcher trigger" },
  ui_currency_dirham: { uid: "", note: "managed AED currency symbol (replacing static svg)" },

  // --- Dynamic App Actions (Notifications / Lists) ---
  ui_action_view: { uid: "", note: "action indicator: Eye/View" },
  ui_action_delete: { uid: "", note: "action indicator: Trash/Delete/Reject" },
  ui_action_confirm: { uid: "", note: "action indicator: Check/Confirm/Approve" },
  ui_action_restore: { uid: "", note: "action indicator: Undo/Restore/Retrieve" },
  ui_action_pdf: { uid: "", note: "quotation action: Download PDF" },
  ui_action_email: { uid: "", note: "quotation action: Send Email" },
  ui_action_clone: { uid: "", note: "quotation action: Clone" },
  ui_action_extend: { uid: "", note: "quotation action: Extend" },
  ui_action_accept: { uid: "", note: "quotation action: Accept" },
  ui_action_cancel: { uid: "", note: "quotation action: Cancel" },

  // --- Chat Assistant Personalization ---
  bot_avatar: { uid: "", note: "ayman bot chatbot avatar" },
  ui_chat_guide: { uid: "", note: "chat guide / greeting image icons" },

  // --- System / Window Controls ---
  ui_win_controls: { uid: "", note: "titlebar: min/max/close controls" },
  ui_page_fallback: { uid: "", note: "generic system-wide fallback icon" },
};
