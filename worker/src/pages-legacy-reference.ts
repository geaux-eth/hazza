// =========================================================================
// LEGACY SSR PAGE FUNCTIONS — REFERENCE ONLY
// =========================================================================
//
// This file contains all the legacy server-side rendered page functions
// that were removed from pages.ts when the worker migrated to SPA-only
// rendering via spaShell().
//
// These functions are NOT imported or used anywhere. They are preserved
// purely as a reference for the HTML/CSS patterns and inline scripts
// that were used in the original SSR implementation.
//
// The worker now serves all pages through spaShell() which loads the
// React SPA from Cloudflare Pages (hazza-app.pages.dev).
//
// Functions preserved here:
//   - landingPage()
//   - registerPage()
//   - managePage()
//   - dashboardPage()
//   - profilePage()
//   - aboutPage()
//   - nomiPage()
//   - pricingPage()
//   - pricingProtectionsPage()
//   - pricingDetailsPage()
//   - docsPage()
//   - domainsPage()
//   - domainsManagePage()
//   - marketplacePage()
//
// Plus helper functions: shell(), profileShell(), searchScript(),
//   nomiWalkthroughScript(), buildSocialLinks(), statusBadge()
//
// Plus constants: STYLES, NAV, NAV_SCRIPT, NOMI_CHAT_SCRIPT,
//   NOMI_CHAT_FALLBACK, NOMI_XMTP_ADDR, ETHERS_CDN, REGISTER_SCRIPT,
//   ProfileData type, SOCIAL_LABELS
//
// KNOWN BUG (preserved from original):
//   In managePage(), line ~2634 of the original pages.ts, the message.mode
//   save button calls `saveRecord('message.mode', ...)` but the function
//   is named `saveField()`. This was a dead-code bug since the SSR manage
//   page was replaced by the React SPA before the bug was caught.
//   The correct call should be: saveField('message.mode', 'field-message-mode')
//
// The original file was ~6660 lines. The full content is available in
// git history. This reference file contains only the header comment
// documenting what was here and the known bugs.
// =========================================================================
