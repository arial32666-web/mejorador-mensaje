// Enhance Message — entry script
//
// The actual UI (scene input, OOC input, Enhance / Try Again / Use This)
// lives in ui/panel-me.html, mounted at /chat/body/end and always present
// on the chat page (with its own floating action button).
//
// The input-action handler below just gives users a second way to open the
// same panel from the input box "+" menu, in case they prefer that over the
// FAB. Both open paths dispatch the same 'ime-open-enhancer' window event
// that the panel fragment listens for.

tavo.plugin.onInputAction('open-enhancer', async () => {
  window.dispatchEvent(new CustomEvent('ime-open-enhancer', { detail: { tab: 'user' } }));
});

tavo.plugin.onInputAction('open-enhancer-char', async () => {
  window.dispatchEvent(new CustomEvent('ime-open-enhancer', { detail: { tab: 'char' } }));
});

// Sidebar actions mirror the input actions above: same open event, so the
// panel opens on the same tab whether triggered from the "+" menu or the
// right sidebar.
tavo.plugin.onSidebarAction('open-enhancer', async () => {
  window.dispatchEvent(new CustomEvent('ime-open-enhancer', { detail: { tab: 'user' } }));
});

tavo.plugin.onSidebarAction('open-enhancer-char', async () => {
  window.dispatchEvent(new CustomEvent('ime-open-enhancer', { detail: { tab: 'char' } }));
});
