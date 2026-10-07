// Pin a stored theme choice before first paint (see src/app/theme.ts). A file rather than an
// inline script, so the Content-Security-Policy can forbid inline scripts altogether.
try {
  var theme = localStorage.getItem('rvd.theme')
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme
} catch (e) {}
