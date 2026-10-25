export const SESSION_MARKUP = `
  <main class="layout">
    <section class="builder">
      <header class="editor-heading"><h1>Session template</h1><label class="field template-name">Session template name <input type="text" data-template-name></label><div data-duration-controls></div></header>
      <div class="toolbar">
        <div class="file-actions">
          <button id="import-session" type="button" class="secondary-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M4 15v4h16v-4"/></svg>
            Import
          </button>
          <button id="export-session" type="button" class="secondary-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M7 8l5-5 5 5M4 15v4h16v-4"/></svg>
            Export
          </button>
          <input id="import-file" type="file" accept=".json,application/json" hidden>
        </div>
        <div id="list-actions" class="list-actions" hidden>
          <button id="expand-all" type="button" class="secondary-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            Expand all
          </button>
          <button id="collapse-all" type="button" class="secondary-btn">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>
            Collapse all
          </button>
        </div>
      </div>
      <p id="file-message" class="error" role="alert"></p>
      <ol id="exercises" class="exercises"></ol>
      <p id="empty" class="empty">No exercises yet. Add one to start building your session template.</p>
      <button id="add-exercise" class="add-btn" type="button">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        Add exercise
      </button>
      <p id="reorder-hint" class="visually-hidden">Drag, or use the up and down arrow keys, to move this exercise.</p>
      <p id="order-status" class="visually-hidden" aria-live="polite"></p>
    </section>

    <aside class="panel" aria-labelledby="volume-title">
      <div class="panel-head">
        <h2 id="volume-title">Volume</h2>
        <span class="unit">sets per muscle</span>
        <button id="open-goals" type="button" class="secondary-btn">Set goals</button>
      </div>
      <div class="panel-visual"><div id="body-map" class="body-map"></div>
      <ul id="heat-key" class="heat-key" aria-hidden="true">
        <li data-heat="0">0</li>
        <li data-heat="1">1–3</li>
        <li data-heat="2">4–6</li>
        <li data-heat="3">7–9</li>
        <li data-heat="4">10+</li>
      </ul></div>
      <div class="readout"><p id="readout" aria-live="polite"></p></div>
      <div class="panel-data">
      <ul id="split-key" class="split-key" aria-hidden="true">
        <li class="direct">Direct</li>
        <li class="indirect">Indirect</li>
      </ul>
      <ul id="volume" class="volume-list"></ul>
      <p id="volume-empty" class="volume-empty" hidden>No volume yet. Add an exercise or set a goal.</p>
      </div>
    </aside>
  </main>

  <dialog id="goals-dialog" class="goals-dialog" aria-labelledby="goals-title">
    <div class="dialog-body">
      <h2 id="goals-title">Volume goals</h2>
      <p class="dialog-hint">Target sets per muscle. Slide to the far left for no goal.</p>
      <div id="goal-fields" class="goal-fields"></div>
      <form method="dialog"><button class="add-btn">Done</button></form>
    </div>
  </dialog>
`;
