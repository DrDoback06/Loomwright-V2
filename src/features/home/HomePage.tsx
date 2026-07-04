export function HomePage() {
  return (
    <div className="lw-page">
      <div>
        <h1 className="lw-page__title">Loomwright</h1>
        <p className="lw-page__subtitle">
          Local-first writing &amp; worldbuilding. Shape the book. Track the world.
        </p>
      </div>

      <div className="lw-card">
        <h2 style={{ marginTop: 0, fontFamily: 'var(--font-display)' }}>
          The rebuild is under way
        </h2>
        <p>
          Loomwright is being rebuilt from the ground up so that every button does exactly what
          it says. Surfaces appear in the sidebar as they become genuinely usable — nothing here
          is a mock-up.
        </p>
        <p style={{ color: 'var(--ink-3)', marginBottom: 0 }}>
          Next up: projects, the character codex, and the Writer&apos;s Room.
        </p>
      </div>
    </div>
  );
}
