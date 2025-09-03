// JSDOM provides window and localStorage by default.
// Add lightweight helpers or global mocks here if needed.

// Ensure a clean localStorage across tests
beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
});

