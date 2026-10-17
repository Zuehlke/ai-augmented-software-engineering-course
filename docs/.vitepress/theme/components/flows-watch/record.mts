// Records the frames that <FlowsWatch> plays in Labs 9 to 13, with the real `flows watch` renderer:
// scripted snapshots in, character grids out. Each lab is recorded with the `flows watch` of its own branch of
// Zuehlke/ai-augmented-software-engineering. Run it again when `flows watch` changes there (any tsx >= 4):
//
//   git worktree add /tmp/lab-10 lab/ralph-loop
//   npx tsx docs/.vitepress/theme/components/flows-watch/record.mts /tmp/lab-10/.harness/src 10
//
// Lab 9 is lab/durable-workflows, Lab 10 lab/ralph-loop, Lab 11 lab/parallelizing-work, Lab 12 lab/orchestration,
// Lab 13 lab/evals.
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = path.resolve(process.argv[2]);
const lab = process.argv[3];
const BRANCH = ({ '9': 'lab/durable-workflows', '10': 'lab/ralph-loop', '11': 'lab/parallelizing-work', '12': 'lab/orchestration', '13': 'lab/evals' } as Record<string, string>)[lab];
if (!BRANCH) throw new Error('Which lab? 9, 10, 11, 12 or 13');
const outDir = path.dirname(fileURLToPath(import.meta.url));
const { render } = await import(path.join(srcDir, 'watch/view/index.ts'));
const { needs } = await import(path.join(srcDir, 'watch/model.ts'));

const W = 120;
const H = 30;

type Snapshot = any;
type Ui = any;

const BASE_BACKLOG = [
  { id: 'TICKET-1', title: 'Normalize delay data model', status: 'done' },
  { id: 'TICKET-2', title: 'Airline overview dashboard', status: 'done' },
  { id: 'TICKET-3', title: 'Flight status lookup', status: 'done' },
  { id: 'TICKET-4', title: 'Airport reference enrichment for flight status', status: 'blocked' },
];
const NEW_TICKETS = [
  { id: 'TICKET-5', title: 'Delayed departures per airport on the dashboard', status: 'ready' },
  { id: 'TICKET-6', title: 'Airlines with the most delayed flights', status: 'ready' },
];
const BACKLOG = [...BASE_BACKLOG, ...NEW_TICKETS];
const REQUEST =
  'On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search.';

// What the pipeline's agents cost by each step, about what our runs cost with two tickets. While the loops
// implement, flows watch adds what they cost so far: none here, they only count once they're done.
const COST: Record<string, number> = {
  researching: 0.45, planning: 0.95, 'waiting for your approval': 1.6, implementing: 1.6,
  reviewing: 5.9, 'waiting for your merge decision': 6.5, merging: 6.5, done: 6.5,
};
const status = (step: string, extra: object = {}) => ({
  step,
  costUsd: COST[step],
  into: BRANCH,
  tickets: ['TICKET-5', 'TICKET-6'],
  unfinished: [],
  review: '',
  approvedBranches: [],
  merged: [],
  notMerged: [],
  ...extra,
});

// Labs 9-12 have no .harness/evals/ yet, so no Evals tab
const snap = (extra: Partial<Snapshot>): Snapshot => ({ temporal: true, worker: true, loops: [], others: [], backlog: BASE_BACKLOG, log: [], evalReports: [], skillReports: [], withoutEvals: lab !== '13', ...extra });
const pipeline = (step: string, extra: object = {}, state = 'running') => ({ workflowId: 'pipeline', state, status: status(step, extra) });

// Styles as a small table, each cell's style as an index into it
const styles: string[] = [];
const styleOf = (c: any) => {
  const key = `${c.fg ?? ''}|${c.bg ?? ''}|${c.bold ? 'b' : ''}`;
  let i = styles.indexOf(key);
  if (i < 0) i = styles.push(key) - 1;
  return i;
};

interface Frame {
  rows: [string, number][][];
  ms: number;
  key?: string;
  caption?: string;
}

function grab(s: Snapshot, ui: Ui, ms: number, key?: string, caption?: string): Frame {
  const g = render(s, ui, W, H);
  const rows = g.cells.map((row: any[]) => {
    const runs: [string, number][] = [];
    for (const cell of row) {
      const st = styleOf(cell);
      const last = runs[runs.length - 1];
      if (last && last[1] === st) last[0] += cell.ch;
      else runs.push([cell.ch, st]);
    }
    return runs;
  });
  return { rows, ms, key, caption };
}

class Scene {
  frames: Frame[] = [];
  ui: Ui = { view: 'pipeline', need: 0, column: 0, scroll: [], cursor: [], stage: 0, tick: 0, branch: BRANCH };
  constructor(public s: Snapshot) {}
  // One frame, then `n` more with the spinner turning
  show(ms: number, opts: { key?: string; caption?: string; spin?: number } = {}) {
    this.frames.push(grab(this.s, this.ui, ms, opts.key, opts.caption));
    for (let i = 0; i < (opts.spin ?? 0); i++) {
      this.ui.tick++;
      this.frames.push(grab(this.s, this.ui, 160, undefined, opts.caption));
    }
    this.ui.tick++;
  }
  // The worker output grows by these lines, one frame each
  log(lines: string[], caption?: string) {
    for (const line of lines) {
      this.s = { ...this.s, log: [...this.s.log, line] };
      this.show(420, { caption });
    }
  }
}

// The scenes are written at the end, when the style table is complete
const scenes: [string, Scene][] = [];
const out = (name: string, scene: Scene) => scenes.push([name, scene]);

function write(name: string, scene: Scene) {
  // Every distinct row once, the frames point at them
  const rows: string[] = [];
  const index = new Map<string, number>();
  const frames = scene.frames.map(({ rows: fr, ...rest }) => ({
    ...rest,
    rows: fr.map((row) => {
      const key = JSON.stringify(row);
      if (!index.has(key)) index.set(key, rows.push(key) - 1);
      return index.get(key)!;
    }),
  }));
  const json = `{"width":${W},"height":${H},"styles":${JSON.stringify(styles)},"rows":[${rows.join(',')}],"frames":${JSON.stringify(frames)}}`;
  writeFileSync(path.join(outDir, `${name}.json`), json + '\n');
  console.log(name, scene.frames.length, 'frames');
}

if (lab === '11') {
  const ticket2 = { id: 'TICKET-2', title: 'Airline overview dashboard', status: 'ready' };
  const ticket3 = { id: 'TICKET-3', title: 'Flight status lookup', status: 'ready' };
  const BACKLOG = [
    { id: 'TICKET-1', title: 'Normalize delay data model', status: 'done' },
    ticket2,
    ticket3,
    { id: 'TICKET-4', title: 'Airport reference enrichment for flight status', status: 'blocked' },
  ];
  const CONTENT: Record<string, string> = {
    'TICKET-2': `---
id: TICKET-2
status: ready
---

# Airline overview dashboard

Support staff can open the dashboard page, enter an airline code, and see that airline's name plus how many of its flights are currently active or scheduled, without writing any query themselves.

## Acceptance Criteria

- The dashboard page displays a search box for an airline code.
- Submitting a valid airline code shows the airline's name and a count of its currently active or scheduled flights.
- Submitting an airline code that doesn't exist shows a clear "not found" message instead of an error page or a blank result.
`,
    'TICKET-3': `---
id: TICKET-3
status: ready
---

# Flight status lookup

On the dashboard page, support staff can enter a flight number and see its current status (on time / delayed / cancelled) and its delay in minutes, without knowing the query API.

## Acceptance Criteria

- The dashboard page displays a search box for a flight number.
- Submitting a valid flight number shows its current status as one of: on time, delayed, or cancelled.
- Submitting a flight number that doesn't exist shows a clear "not found" message instead of an error page or a blank result.
`,
  };
  const loopOf = (ticket: string, o: object = {}) => ({ workflowId: `ralph-${ticket}`, ticket, state: 'running', run: 1, ...o });
  const L2 = '[ralph-TICKET-2]';
  const L3 = '[ralph-TICKET-3]';

  // ── 1. One Ralph loop per ticket ─────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({ backlog: BACKLOG }));
    sc.ui.view = 'board';
    sc.ui.column = 2;
    sc.ui.cursor[2] = 0;
    sc.show(2200, { caption: 'Two ready tickets, independent of each other' });
    sc.ui.dialog = { kind: 'start', ticket: 'TICKET-2', title: ticket2.title };
    sc.show(2400, { key: 's', caption: 's on TICKET-2' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started ralph-TICKET-2.';
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2')] };
    sc.show(160, { key: 'y', spin: 8, caption: 'y lets it loop' });
    sc.ui.message = undefined;
    sc.ui.cursor[2] = 0; // TICKET-3 is the only one left in Ready
    sc.ui.dialog = { kind: 'start', ticket: 'TICKET-3', title: ticket3.title };
    sc.show(2400, { key: 's', caption: 's on TICKET-3' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started ralph-TICKET-3.';
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2'), loopOf('TICKET-3')] };
    sc.show(160, { key: 'y', spin: 10, caption: 'Both loops run at the same time' });
    sc.ui.message = undefined;
    sc.ui.view = 'pipeline';
    sc.show(160, { key: 'Tab', spin: 2, caption: 'The output mixes both, each line with its loop' });
    sc.log(
      [
        `${L2} == implement: claude`,
        `${L3} == implement: claude`,
        `${L2} Added the airline search box to the dashboard`,
        `${L3} Added the flight number search box to the dashboard`,
        `${L2} Committed: Show an airline's name and its active flights`,
      ],
      'The output mixes both, each line with its loop',
    );
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2', { judging: true }), loopOf('TICKET-3')] };
    sc.log([`${L2} == judge implement: claude`, `${L3} Committed: Show a flight's status and delay`], 'The output mixes both, each line with its loop');
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2', { judging: true }), loopOf('TICKET-3', { judging: true })] };
    sc.log([`${L3} == judge implement: claude`, `${L2} PASS`], 'The output mixes both, each line with its loop');
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2', { run: 2 }), loopOf('TICKET-3', { judging: true })] };
    sc.log([`${L2} == implement: claude`, `${L3} PASS`], 'The output mixes both, each line with its loop');
    sc.ui.view = 'board';
    sc.s = { ...sc.s, loops: [loopOf('TICKET-2', { run: 2 }), loopOf('TICKET-3', { run: 2 })] };
    sc.show(160, { key: 'Tab', spin: 14, caption: 'On the board, both cards are in Running' });
    out('lab11-start', sc);
  }

  // ── 3. Both done, and 4. throwing them away ──────────────────────────────────────────────────
  {
    const done = (ticket: string, run: number) => loopOf(ticket, { state: 'done', run, merged: false });
    const sc = new Scene(snap({ backlog: BACKLOG, loops: [done('TICKET-2', 5), done('TICKET-3', 6)] }));
    sc.ui.view = 'board';
    sc.ui.column = 0;
    sc.ui.cursor[0] = 0;
    sc.show(3500, { caption: 'Both loops are done: ready to merge, each on its own branch' });
    sc.ui.dialog = { kind: 'ticket', ticket: ticket2, content: CONTENT['TICKET-2'], scroll: 0, start: false, merge: true, discard: true };
    sc.show(2400, { key: '⏎', caption: 'Enter opens TICKET-2' });
    sc.ui.dialog = { kind: 'discard', ticket: 'TICKET-2', title: ticket2.title, running: false, commits: 4 };
    sc.show(3500, { key: 'x', caption: 'x throws its worktree and branch away' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Threw away .harness/worktrees/ticket-2 and agent/ticket-2.';
    sc.s = { ...sc.s, loops: [done('TICKET-3', 6)] };
    sc.show(2400, { key: 'y' });
    sc.ui.message = undefined;
    sc.ui.dialog = { kind: 'ticket', ticket: ticket3, content: CONTENT['TICKET-3'], scroll: 0, start: false, merge: true, discard: true };
    sc.show(1800, { key: '⏎', caption: 'The same for TICKET-3' });
    sc.ui.dialog = { kind: 'discard', ticket: 'TICKET-3', title: ticket3.title, running: false, commits: 5 };
    sc.show(2400, { key: 'x', caption: 'The same for TICKET-3' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Threw away .harness/worktrees/ticket-3 and agent/ticket-3.';
    sc.s = { ...sc.s, loops: [] };
    sc.ui.column = 2;
    sc.show(3500, { key: 'y', caption: 'Both tickets are ready again' });
    out('lab11-cleanup', sc);
  }
}

if (lab === '12') {
// ── Overview: the whole pipeline, end to end, in short ─────────────────────────────────────────
{
  const sc = new Scene(snap({}));
  const loops = (a: object, b: object) => [
    { workflowId: 'pipeline-TICKET-5', ticket: 'TICKET-5', state: 'running', run: 1, ...a },
    { workflowId: 'pipeline-TICKET-6', ticket: 'TICKET-6', state: 'running', run: 1, ...b },
  ];
  const review = 'agent/ticket-5: APPROVE\nagent/ticket-6: APPROVE';
  const branches = ['agent/ticket-5', 'agent/ticket-6'];
  sc.show(1400, { caption: 'You give it a feature request' });
  sc.ui.dialog = { kind: 'request', text: REQUEST };
  sc.show(1800, { key: '⏎', caption: 'You give it a feature request' });
  sc.ui.dialog = undefined;
  sc.s = { ...sc.s, pipeline: pipeline('researching'), log: ['[pipeline] == research: claude'] };
  sc.show(160, { key: '⏎', spin: 10, caption: 'The research agent writes a specification' });
  sc.s = { ...sc.s, pipeline: pipeline('planning'), log: [...sc.s.log, '[pipeline] PASS', '[pipeline] == plan: claude'] };
  sc.show(160, { spin: 10, caption: 'The plan agent slices it into tickets' });
  sc.s = { ...sc.s, backlog: BACKLOG, pipeline: pipeline('waiting for your approval'), log: [...sc.s.log, '[pipeline] PASS'] };
  sc.show(1600, { caption: 'You approve the tickets' });
  sc.ui.dialog = { kind: 'approve', need: needs(sc.s)[0], selected: new Set(['TICKET-5', 'TICKET-6']), cursor: 1 };
  sc.show(1800, { key: 'n', caption: 'You approve the tickets' });
  sc.ui.dialog = undefined;
  sc.s = {
    ...sc.s,
    pipeline: pipeline('implementing'),
    loops: loops({}, {}),
    log: [...sc.s.log, '[pipeline-TICKET-5] == implement: claude', '[pipeline-TICKET-6] == implement: claude'],
  };
  sc.show(160, { key: '⏎', spin: 8, caption: 'One Ralph loop per ticket, in parallel' });
  sc.s = { ...sc.s, loops: loops({ run: 2 }, { run: 2 }) };
  sc.show(160, { spin: 8, caption: 'One Ralph loop per ticket, in parallel' });
  sc.s = { ...sc.s, loops: loops({ state: 'done', run: 3 }, { run: 3 }) };
  sc.show(160, { spin: 6, caption: 'One Ralph loop per ticket, in parallel' });
  sc.s = {
    ...sc.s,
    pipeline: pipeline('reviewing'),
    loops: loops({ state: 'done', run: 3 }, { state: 'done', run: 3 }),
    log: [...sc.s.log, '[pipeline] == review: claude'],
  };
  sc.show(160, { spin: 10, caption: 'The review agent reviews every branch' });
  sc.s = {
    ...sc.s,
    pipeline: pipeline('waiting for your merge decision', { review, approvedBranches: branches }),
    loops: loops({ state: 'done', run: 3, merged: false }, { state: 'done', run: 3, merged: false }),
    log: [...sc.s.log, '[pipeline] agent/ticket-5: APPROVE', '[pipeline] agent/ticket-6: APPROVE'],
  };
  sc.show(1600, { caption: 'You decide whether to merge' });
  sc.ui.dialog = { kind: 'merge', need: needs(sc.s)[0] };
  sc.show(2200, { key: 'n', caption: 'You decide whether to merge' });
  sc.ui.dialog = undefined;
  sc.s = { ...sc.s, pipeline: pipeline('merging', { review, approvedBranches: branches }) };
  sc.show(160, { key: 'y', spin: 6, caption: 'You decide whether to merge' });
  sc.s = {
    ...sc.s,
    pipeline: pipeline('done', { review, approvedBranches: branches, merged: branches, testsPass: true }, 'done'),
    loops: loops({ state: 'done', run: 3, merged: true }, { state: 'done', run: 3, merged: true }),
    log: [...sc.s.log, '[pipeline] Merged agent/ticket-5', '[pipeline] Merged agent/ticket-6', '[pipeline] Tests pass'],
  };
  sc.show(3000, { caption: 'Merged onto your branch' });
  out('lab12-overview', sc);
}

// ── 1. Start the pipeline ──────────────────────────────────────────────────────────────────────
{
  const sc = new Scene(snap({}));
  sc.show(2200, { caption: 'The Specification stage is selected' });
  sc.ui.dialog = { kind: 'request', text: '' };
  sc.show(900, { key: '⏎', caption: 'Enter opens the feature request' });
  const words = REQUEST.split(' ');
  for (let i = 4; i <= words.length + 3; i += 4) {
    sc.ui.dialog = { kind: 'request', text: words.slice(0, i).join(' ') };
    sc.show(110, { key: i === 4 ? '⌘V' : undefined, caption: 'Paste the feature request' });
  }
  sc.show(1600, { caption: 'Paste the feature request' });
  sc.ui.dialog = undefined;
  sc.ui.message = 'Started the pipeline.';
  sc.s = { ...sc.s, pipeline: pipeline('researching') };
  sc.show(500, { key: '⏎', caption: 'Enter starts the pipeline' });
  sc.log(
    [
      '[pipeline] == research: claude',
      '[pipeline] Reading the research skill and the feature request',
      '[pipeline] Looking at the dashboard page and the delay data',
      '[pipeline] Wrote specs/delayed-departures/specification.md',
    ],
    'The research agent writes the specification',
  );
  sc.ui.message = undefined;
  sc.show(160, { spin: 6, caption: 'The research agent writes the specification' });
  sc.s = { ...sc.s, pipeline: pipeline('researching', { judging: true }) };
  sc.log(['[pipeline] == judge research: claude', '[pipeline] PASS'], 'Its judge checks it');
  sc.show(160, { spin: 4, caption: 'Its judge checks it' });
  sc.s = { ...sc.s, pipeline: pipeline('planning') };
  sc.log(
    [
      '[pipeline] == plan: claude',
      '[pipeline] Slicing the specification into vertical slices',
      '[pipeline] Wrote backlog/TICKET-5-delayed-departures-per-airport.md',
      '[pipeline] Wrote backlog/TICKET-6-airlines-with-most-delays.md',
    ],
    'The plan agent writes the tickets',
  );
  sc.show(160, { spin: 6, caption: 'The plan agent writes the tickets' });
  sc.s = { ...sc.s, pipeline: pipeline('planning', { judging: true }) };
  sc.log(['[pipeline] == judge plan: claude', '[pipeline] PASS'], 'Its judge checks them');
  sc.show(160, { spin: 4, caption: 'Its judge checks them' });
  sc.s = { ...sc.s, backlog: BACKLOG, pipeline: pipeline('waiting for your approval') };
  sc.show(4000, { caption: 'The tickets wait for you' });
  out('lab12-start', sc);
}

const planLog = [
  '[pipeline] == research: claude',
  '[pipeline] Wrote specs/delayed-departures/specification.md',
  '[pipeline] == judge research: claude',
  '[pipeline] PASS',
  '[pipeline] == plan: claude',
  '[pipeline] Wrote backlog/TICKET-5-delayed-departures-per-airport.md',
  '[pipeline] Wrote backlog/TICKET-6-airlines-with-most-delays.md',
  '[pipeline] == judge plan: claude',
  '[pipeline] PASS',
];

// ── 2. Approve the tickets ─────────────────────────────────────────────────────────────────────
{
  const sc = new Scene(snap({ backlog: BACKLOG, pipeline: pipeline('waiting for your approval'), log: planLog }));
  sc.show(2400, { caption: 'The tickets wait for you' });
  const need = needs(sc.s)[0];
  sc.ui.dialog = { kind: 'approve', need, selected: new Set<string>(), cursor: 0 };
  sc.show(1800, { key: 'n', caption: 'n opens the approval' });
  sc.ui.dialog.selected = new Set(['TICKET-5']);
  sc.show(1100, { key: 'Space', caption: 'Space selects a ticket' });
  sc.ui.dialog.cursor = 1;
  sc.show(800, { key: '↓', caption: 'Space selects a ticket' });
  sc.ui.dialog.selected = new Set(['TICKET-5', 'TICKET-6']);
  sc.show(1600, { key: 'Space', caption: 'Space selects a ticket' });
  sc.ui.dialog = undefined;
  sc.ui.message = 'Approved: TICKET-5 TICKET-6';
  sc.s = {
    ...sc.s,
    pipeline: pipeline('implementing'),
    loops: [
      { workflowId: 'pipeline-TICKET-5', ticket: 'TICKET-5', state: 'running', run: 1 },
      { workflowId: 'pipeline-TICKET-6', ticket: 'TICKET-6', state: 'running', run: 1 },
    ],
  };
  sc.show(500, { key: '⏎', caption: 'Enter approves them: one Ralph loop each' });
  sc.log(['[pipeline-TICKET-5] == implement: claude', '[pipeline-TICKET-6] == implement: claude'], 'Enter approves them: one Ralph loop each');
  sc.show(160, { spin: 14, caption: 'Enter approves them: one Ralph loop each' });
  out('lab12-approve', sc);
}

// ── 3. The implement loops and the review agent ────────────────────────────────────────────────
{
  const loops = (a: object, b: object) => [
    { workflowId: 'pipeline-TICKET-5', ticket: 'TICKET-5', state: 'running', run: 1, ...a },
    { workflowId: 'pipeline-TICKET-6', ticket: 'TICKET-6', state: 'running', run: 1, ...b },
  ];
  const sc = new Scene(
    snap({
      backlog: BACKLOG,
      pipeline: pipeline('implementing'),
      loops: loops({}, {}),
      log: [...planLog, '[pipeline-TICKET-5] == implement: claude', '[pipeline-TICKET-6] == implement: claude'],
    }),
  );
  sc.show(160, { spin: 6, caption: 'One Ralph loop per ticket, at the same time' });
  sc.log(
    ['[pipeline-TICKET-5] Added DelayedDeparturesQuery with a test', '[pipeline-TICKET-6] Added the delayed airlines ranking with a test'],
    'One Ralph loop per ticket, at the same time',
  );
  sc.s = { ...sc.s, loops: loops({ judging: true }, {}) };
  sc.log(['[pipeline-TICKET-5] == judge implement: claude', '[pipeline-TICKET-5] PASS'], 'Each run is checked by a judge');
  sc.s = { ...sc.s, loops: loops({ run: 2 }, {}) };
  sc.show(160, { spin: 4, caption: 'Each run is checked by a judge' });
  // Tab: the board
  sc.ui.view = 'board';
  sc.show(1800, { key: 'Tab', caption: 'Tab shows the backlog board' });
  sc.ui.column = 3;
  sc.ui.cursor[3] = 0;
  sc.show(160, { spin: 6, caption: 'The loops move across the board' });
  sc.ui.cursor[3] = 1;
  sc.show(900, { key: '↓', caption: 'Arrow keys select a card' });
  sc.ui.dialog = {
    kind: 'ticket',
    ticket: NEW_TICKETS[1],
    content: `---
id: TICKET-6
status: ready
---

# Airlines with the most delayed flights

Without any search, the dashboard shows the airlines with the most delayed flights right now.

## Acceptance Criteria

- The dashboard lists the five airlines with the most delayed flights, with their number of delays.
- The list is shown when the page opens, without a search.
- It counts only flights that are delayed right now, from real data.
`,
    scroll: 0,
    start: false,
    merge: false,
  };
  sc.show(3800, { key: '⏎', caption: 'Enter opens its ticket' });
  sc.ui.dialog = undefined;
  sc.s = { ...sc.s, loops: loops({ run: 3 }, { run: 2 }) };
  sc.show(160, { key: 'Esc', spin: 4, caption: 'Esc closes it' });
  sc.s = { ...sc.s, loops: loops({ state: 'done', run: 3 }, { run: 2 }) };
  sc.show(160, { spin: 6, caption: 'A finished loop moves to Done' });
  // Tab: back to the pipeline
  sc.ui.view = 'pipeline';
  sc.s = {
    ...sc.s,
    log: [...sc.s.log, '[pipeline-TICKET-5] == judge implement: claude', '[pipeline-TICKET-5] PASS', '[pipeline-TICKET-6] == implement: claude'],
  };
  sc.show(160, { key: 'Tab', spin: 6, caption: 'Tab gets you back to the pipeline' });
  sc.ui.log = { lines: sc.s.log, scroll: 1 };
  sc.show(500, { key: '↑', caption: '↑ and ↓ scroll the output' });
  sc.ui.log = { lines: sc.s.log, scroll: 2 };
  sc.show(500, { key: '↑', caption: '↑ and ↓ scroll the output' });
  sc.ui.log = { lines: sc.s.log, scroll: 3 };
  sc.show(1600, { key: '↑', caption: '↑ and ↓ scroll the output' });
  sc.ui.log = undefined;
  sc.show(160, { key: 'End', caption: 'End follows the new lines again' });
  sc.s = { ...sc.s, loops: loops({ state: 'done', run: 3 }, { judging: true, run: 2 }) };
  sc.log(['[pipeline-TICKET-6] == judge implement: claude', '[pipeline-TICKET-6] PASS'], 'End follows the new lines again');
  sc.s = { ...sc.s, pipeline: pipeline('reviewing'), loops: loops({ state: 'done', run: 3 }, { state: 'done', run: 2 }) };
  sc.log(['[pipeline] == review: claude', '[pipeline] Reviewing agent/ticket-5 and agent/ticket-6'], 'The review agent reads every finished branch');
  sc.show(160, { spin: 10, caption: 'The review agent reads every finished branch' });
  out('lab12-implement', sc);
}

// ── 4. Decide whether to merge ─────────────────────────────────────────────────────────────────
{
  const review = 'Both branches meet their acceptance criteria and have tests for them.\nagent/ticket-5: APPROVE\nagent/ticket-6: APPROVE';
  const branches = ['agent/ticket-5', 'agent/ticket-6'];
  const done = (merged5: boolean | undefined, merged6: boolean | undefined) => [
    { workflowId: 'pipeline-TICKET-5', ticket: 'TICKET-5', state: 'done', run: 3, merged: merged5 },
    { workflowId: 'pipeline-TICKET-6', ticket: 'TICKET-6', state: 'done', run: 2, merged: merged6 },
  ];
  const log = [
    '[pipeline-TICKET-5] PASS',
    '[pipeline-TICKET-6] == judge implement: claude',
    '[pipeline-TICKET-6] PASS',
    '[pipeline] == review: claude',
    '[pipeline] agent/ticket-5: APPROVE',
    '[pipeline] agent/ticket-6: APPROVE',
  ];
  const sc = new Scene(
    snap({ backlog: BACKLOG, pipeline: pipeline('waiting for your merge decision', { review, approvedBranches: branches }), loops: done(false, false), log }),
  );
  sc.show(2400, { caption: 'The merge decision waits for you' });
  sc.ui.dialog = { kind: 'merge', need: needs(sc.s)[0] };
  sc.show(3600, { key: 'n', caption: "n shows the review agent's verdicts" });
  sc.ui.dialog = undefined;
  sc.ui.message = 'Merging.';
  sc.s = { ...sc.s, pipeline: pipeline('merging', { review, approvedBranches: branches }) };
  sc.show(160, { key: 'y', spin: 8, caption: 'y merges the approved branches' });
  sc.s = {
    ...sc.s,
    pipeline: pipeline('done', { review, approvedBranches: branches, merged: ['agent/ticket-5'], notMerged: ['agent/ticket-6: conflicts'], testsPass: true }, 'done'),
    loops: done(true, false),
    log: [...log, '[pipeline] Merged agent/ticket-5', '[pipeline] agent/ticket-6 conflicts, not merged', '[pipeline] Tests pass'],
  };
  sc.ui.message = undefined;
  sc.show(2400, { caption: 'One branch merges, the other conflicts' });
  sc.ui.view = 'board';
  sc.ui.column = 0;
  sc.show(2000, { key: 'Tab', caption: 'The conflicting branch waits on the board' });
  const card = { id: 'TICKET-6', title: 'Airlines with the most delayed flights', status: 'ready' };
  sc.ui.dialog = {
    kind: 'ticket',
    ticket: card,
    content: `---\nid: TICKET-6\nstatus: ready\n---\n\n# Airlines with the most delayed flights\n\nWithout any search, the dashboard shows the airlines with the most delayed flights right now.\n`,
    scroll: 0,
    start: false,
    merge: true,
  };
  sc.show(2000, { key: '⏎', caption: 'Enter opens it' });
  sc.ui.dialog = {
    kind: 'mergeBranch',
    into: BRANCH,
    preview: {
      ticket: 'TICKET-6',
      title: card.title,
      branch: 'agent/ticket-6',
      commits: ['a41c2e7 Add the delayed airlines ranking', '9b0d5f1 Show the delayed airlines on the dashboard'],
      stat: '4 files changed, 118 insertions(+), 6 deletions(-)',
      uncommitted: [],
      conflicts: true,
    },
  };
  sc.show(4500, { key: 'm', caption: 'm shows its commits and how to rebase it by hand' });
  out('lab12-merge', sc);
}

}

if (lab === '9') {
  const TRACER = [
    { id: 'TICKET-1', title: 'Normalize delay data model', status: 'ready' },
    { id: 'TICKET-2', title: 'Airline overview dashboard', status: 'blocked' },
    { id: 'TICKET-3', title: 'Flight status lookup', status: 'blocked' },
    { id: 'TICKET-4', title: 'Airport reference enrichment for flight status', status: 'blocked' },
  ];
  const CSV = [
    { id: 'TICKET-5', title: 'Download the current delays as a CSV file', status: 'ready' },
    { id: 'TICKET-6', title: 'Filter the CSV download by airline', status: 'blocked' },
  ];
  const SPEC = 'specs/delays-csv-export/specification.md';
  const plan = [{ workflowId: 'plan', state: 'running' }];
  const working = [
    '[plan] == plan: claude',
    '[plan] Reading the plan skill and specs/delays-csv-export/specification.md',
    '[plan] Looking at GET /delays and its airline filter',
  ];

  // ── 2. Open flows watch: what runs, its output, and scrolling it ─────────────────────────
  {
    const output = [
      ...working,
      '[plan] The specification has five acceptance criteria and two non-goals',
      '[plan] GET /delays already filters by airline_code',
      '[plan] Slice 1: GET /delays.csv with all current delays',
      '[plan] Slice 2: the airline filter, on top of slice 1',
      '[plan] Slice 1 depends on nothing new: ready',
      '[plan] Slice 2 needs slice 1: blocked',
      '[plan] Wrote backlog/TICKET-5-delays-csv-download.md',
      '[plan] Wrote backlog/TICKET-6-csv-airline-filter.md',
      '[plan] Checking every acceptance criterion is in a ticket',
      '[plan] Assumption: the CSV uses a comma and UTF-8',
      '[plan] Wrote the assumption into TICKET-5',
      '[plan] Committed: Add the tickets for the CSV export',
    ];
    const sc = new Scene(snap({ backlog: TRACER, others: plan, log: output.slice(0, 6) }));
    sc.show(160, { spin: 6, caption: 'What runs, and below it the worker output' });
    sc.log(output.slice(6), 'What runs, and below it the worker output');
    sc.show(160, { spin: 4, caption: 'What runs, and below it the worker output' });
    for (let n = 1; n <= 4; n++) {
      sc.ui.log = { lines: sc.s.log, scroll: n };
      sc.show(n === 4 ? 2200 : 450, { key: '↑', caption: '↑ scrolls back, the output holds still' });
    }
    sc.s = { ...sc.s, log: [...sc.s.log, '[plan] Done'] };
    sc.ui.log = { lines: sc.ui.log.lines, scroll: 3 };
    sc.show(1200, { key: '↓', caption: '↓ scrolls forward again' });
    sc.ui.log = undefined;
    sc.show(160, { key: 'End', spin: 14, caption: 'End follows the new lines again' });
    out('lab9-watch', sc);
  }

  // ── 3. Run the plan agent ──────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({ backlog: TRACER }));
    sc.show(2000, { caption: 'Nothing runs yet' });
    sc.ui.stage = 1;
    sc.show(1400, { key: '→', caption: '→ selects the Plan tickets phase' });
    sc.ui.dialog = { kind: 'pick', target: 'plan', items: [{ id: SPEC, title: '' }], cursor: 0 };
    sc.show(2200, { key: '⏎', caption: 'Enter shows the specifications' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started the plan agent.';
    sc.s = { ...sc.s, others: plan };
    sc.show(160, { key: '⏎', spin: 6, caption: 'Enter starts the plan agent on it' });
    sc.ui.message = undefined;
    sc.log(working, 'It runs under Other workflows, its output below');
    sc.show(160, { spin: 12, caption: 'It runs under Other workflows, its output below' });
    out('lab9-plan', sc);
  }

  // ── 4. Check the result ──────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(
      snap({
        backlog: [...TRACER, ...CSV],
        log: [...working, '[plan] == plan: claude', '[plan] Wrote backlog/TICKET-5-delays-csv-download.md', '[plan] Wrote backlog/TICKET-6-csv-airline-filter.md'],
      }),
    );
    sc.show(2000, { caption: 'The workflow is done' });
    sc.ui.view = 'board';
    sc.show(2400, { key: 'Tab', caption: 'Tab shows the board, with the new tickets' });
    sc.ui.column = 2;
    sc.ui.cursor[2] = 0;
    sc.show(1000, { key: '→', caption: 'Arrow keys select a ticket' });
    sc.ui.cursor[2] = 1;
    sc.show(1200, { key: '↓', caption: 'Arrow keys select a ticket' });
    sc.ui.dialog = {
      kind: 'ticket',
      ticket: CSV[0],
      content: `---
id: TICKET-5
status: ready
---

# Download the current delays as a CSV file

Support staff download the current delays as a file they can open in a spreadsheet.

## Acceptance Criteria

- \`GET /delays.csv\` returns the current delays with the content type \`text/csv\`, as \`delays.csv\`.
- The first row holds the column names: \`flight_number,airline,status,delay_minutes\`.
- Every other row is one flight, with the same values as \`GET /delays\`.
- Values that contain a comma or a quote are quoted as RFC 4180 describes.
`,
      scroll: 0,
      start: true,
      merge: false,
    };
    sc.show(5000, { key: '⏎', caption: 'Enter opens it' });
    out('lab9-board', sc);
  }
}

if (lab === '10') {
  const ticket1 = { id: 'TICKET-1', title: 'Normalize delay data model', status: 'ready' };
  const TRACER = [
    ticket1,
    { id: 'TICKET-2', title: 'Airline overview dashboard', status: 'blocked' },
    { id: 'TICKET-3', title: 'Flight status lookup', status: 'blocked' },
    { id: 'TICKET-4', title: 'Airport reference enrichment for flight status', status: 'blocked' },
  ];
  const CONTENT = `---
id: TICKET-1
status: ready
---

# Normalize delay data model

Delay data is restructured from a single flat table into separate airline, flight, and delay-event data, so airline-level and flight-level questions can be answered correctly and efficiently instead of by scanning one flat table.

## Acceptance Criteria

- Airline data (code, name) is stored and queryable independently of individual delay records.
- Flight data (flight id, airline, departure/arrival airport codes, schedule) is stored and queryable independently of individual delay records.
- Delay/status events (on time / delayed / cancelled, delay minutes, timestamp) are stored linked to a specific flight, with multiple events per flight supported.
`;
  const loop = (o: object = {}) => [{ workflowId: 'ralph-TICKET-1', ticket: 'TICKET-1', state: 'running', run: 1, ...o }];
  const L = '[ralph-TICKET-1]';
  const QUESTION = 'Replace the flat flights table now, or keep it until TICKET-4?';
  const ANSWER = 'Keep the flat flights table until TICKET-4.';

  // Board, with TICKET-1 in Ready selected
  const onReady = (sc: Scene) => {
    sc.ui.view = 'board';
    sc.ui.column = 2;
    sc.ui.cursor[2] = 0;
  };

  // ── 1. One run, watching ─────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({ backlog: TRACER }));
    sc.show(1600, { caption: 'Nothing runs yet' });
    sc.ui.view = 'board';
    sc.show(1600, { key: 'Tab', caption: 'Tab shows the backlog board' });
    onReady(sc);
    sc.show(1400, { key: '→', caption: 'Select TICKET-1 in Ready' });
    sc.ui.dialog = { kind: 'start', ticket: 'TICKET-1', title: ticket1.title };
    sc.show(2600, { key: 's', caption: 's starts a loop on it' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started one run of ralph-TICKET-1.';
    sc.s = { ...sc.s, loops: loop() };
    sc.show(160, { key: '1', spin: 8, caption: '1 starts one run' });
    sc.ui.message = undefined;
    sc.ui.view = 'pipeline';
    sc.show(160, { key: 'Tab', spin: 2, caption: 'Tab gets you back to the worker output' });
    sc.log([`${L} == implement: claude`, `${L} Added the airlines table, filled from the AIRLINE values`, `${L} Committed: Store airlines apart from delays`], 'The agent does one step and commits');
    sc.s = { ...sc.s, loops: loop({ judging: true }) };
    sc.log([`${L} Tests pass`, `${L} == judge implement: claude`], 'Then the judge checks it');
    sc.show(160, { spin: 8, caption: 'Then the judge checks it' });
    sc.s = { ...sc.s, loops: loop({ state: 'stopped' }) };
    sc.log([`${L} PASS`], 'After one run, the loop stops');
    sc.show(4000, { caption: 'After one run, the loop stops' });
    out('lab10-one-run', sc);
  }

  // ── 1. Throw the run away ────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({ backlog: TRACER, loops: loop({ state: 'stopped' }) }));
    onReady(sc);
    sc.show(2000, { caption: 'Select TICKET-1 on the board' });
    sc.ui.dialog = { kind: 'ticket', ticket: ticket1, content: CONTENT, scroll: 0, start: true, merge: false, discard: true };
    sc.show(2600, { key: '⏎', caption: 'Enter opens it' });
    sc.ui.dialog = { kind: 'discard', ticket: 'TICKET-1', title: ticket1.title, running: false, commits: 2 };
    sc.show(3200, { key: 'x', caption: 'x throws the run away' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Threw away .harness/worktrees/ticket-1 and agent/ticket-1.';
    sc.s = { ...sc.s, loops: [] };
    sc.show(4000, { key: 'y', caption: 'y: the next run starts fresh' });
    out('lab10-discard', sc);
  }

  // ── 2. Let it loop ───────────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({ backlog: TRACER }));
    onReady(sc);
    sc.show(1400, { caption: 'Select TICKET-1 on the board' });
    sc.ui.dialog = { kind: 'start', ticket: 'TICKET-1', title: ticket1.title };
    sc.show(1800, { key: 's', caption: 's starts a loop on it' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started ralph-TICKET-1.';
    sc.s = { ...sc.s, loops: loop() };
    sc.show(160, { key: 'y', spin: 6, caption: 'y lets it loop, until the ticket is done' });
    sc.ui.message = undefined;
    sc.ui.view = 'pipeline';
    sc.show(160, { key: 'Tab', spin: 2, caption: 'Each run does one step, the judge checks it' });
    const run = (n: number, step: string, verdict: string) => {
      sc.s = { ...sc.s, loops: loop({ run: n }) };
      sc.log([`${L} == implement: claude`, `${L} ${step}`], 'Each run does one step, the judge checks it');
      sc.s = { ...sc.s, loops: loop({ run: n, judging: true }) };
      sc.log([`${L} == judge implement: claude`, `${L} ${verdict}`], 'Each run does one step, the judge checks it');
    };
    run(1, 'Committed: Store flights apart from delays', 'PASS');
    run(2, 'Committed: Link delay events to flights', 'RETRYABLE: the migration loses the delays of cancelled flights');
    run(3, 'Committed: Keep the delays of cancelled flights', 'AMBIGUOUS: ' + QUESTION);
    sc.s = { ...sc.s, loops: loop({ run: 3, state: 'you', question: QUESTION }) };
    sc.show(2600, { caption: 'The judge asks you a question' });
    sc.ui.dialog = { kind: 'answer', need: needs(sc.s)[0], text: '' };
    sc.show(1400, { key: 'n', caption: 'n opens it' });
    const words = ANSWER.split(' ');
    for (let i = 1; i <= words.length; i++) {
      sc.ui.dialog = { ...sc.ui.dialog, text: words.slice(0, i).join(' ') };
      sc.show(180, { caption: 'Type your answer' });
    }
    sc.show(1400, { caption: 'Type your answer' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Sent. The next run gets your answer.';
    sc.s = { ...sc.s, loops: loop({ run: 4 }) };
    sc.show(160, { key: '⏎', spin: 4, caption: 'Enter sends it to the next run' });
    sc.log([`${L} == implement: claude`], 'Enter sends it to the next run');
    sc.show(160, { spin: 10, caption: 'Enter sends it to the next run' });
    out('lab10-loop', sc);
  }

  // ── 3. Check the result ──────────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(
      snap({
        backlog: TRACER,
        loops: loop({ state: 'done', run: 6, merged: false }),
        log: [`${L} == judge implement: claude`, `${L} PASS`, `${L} TICKET-1 is done`],
      }),
    );
    sc.show(1800, { caption: 'The ticket is done' });
    sc.ui.view = 'board';
    sc.show(2200, { key: 'Tab', caption: 'Its card waits for you: ready to merge' });
    sc.ui.dialog = { kind: 'ticket', ticket: ticket1, content: CONTENT, scroll: 0, start: false, merge: true, discard: true };
    sc.show(2400, { key: '⏎', caption: 'Enter opens it' });
    sc.ui.dialog = {
      kind: 'mergeBranch',
      into: BRANCH,
      preview: {
        ticket: 'TICKET-1',
        title: ticket1.title,
        branch: 'agent/ticket-1',
        commits: [
          '3f1a9c2 Store airlines apart from delays',
          '8d27e41 Store flights apart from delays',
          'c90b5d3 Link delay events to flights',
          '51e7a08 Keep the delays of cancelled flights',
          'a2c4f19 Serve /delays from the new tables',
          'e6b03d7 Set TICKET-1 to done',
        ],
        stat: '14 files changed, 402 insertions(+), 37 deletions(-)',
        uncommitted: [],
        conflicts: false,
      },
    };
    sc.show(4000, { key: 'm', caption: 'm shows the commits the branch brings' });
    sc.ui.dialog = undefined;
    sc.ui.message = `Rebased agent/ticket-1 onto ${BRANCH} and fast-forwarded it, and removed the branch. Run the tests: task test`;
    sc.s = { ...sc.s, backlog: [{ ...ticket1, status: 'done' }, ...TRACER.slice(1)], loops: loop({ state: 'done', run: 6, merged: undefined }) };
    sc.show(4000, { key: 'y', caption: 'y brings them onto your branch' });
    out('lab10-merge', sc);
  }
}

if (lab === '13') {
  // The cases of .agents/skills/<skill>/skill-loaded-evals.json, as on lab/evals
  const CASES = [
    { skill: 'api-design', prompt: 'Add an endpoint that returns all flights of one airline.', loads: true },
    { skill: 'api-design', prompt: 'Add paging to GET /delays.', loads: true },
    { skill: 'api-design', prompt: 'The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.', loads: false },
    { skill: 'api-design', prompt: 'Fix the typos in README.md.', loads: false },
    { skill: 'testing', prompt: 'Add an endpoint that returns all flights of one airline.', loads: true },
    { skill: 'testing', prompt: 'The flight status lookup shows the wrong status when two delay events have the same timestamp. Fix it.', loads: true },
    { skill: 'testing', prompt: 'Fix the typos in README.md.', loads: false },
    { skill: 'testing', prompt: 'Add a task to Taskfile.yml that prints the Java version.', loads: false },
    { skill: 'testing', prompt: 'Explain how DelaysController computes the delay of a flight.', loads: false },
  ];
  const SKILLS = { names: ['api-design', 'testing'], cases: CASES.length };
  const TASKS = ['airline-delay-summary', 'airport-departures', 'delays-csv', 'min-delay-filter', 'status-filter'].map((id) => ({ id, request: '', base: 'b' }));

  // A skill-loaded evals: `loaded` per case, in which of its 3 runs the agent loaded the skill
  const skillReport = (evalsId: string, commit: string, loaded: boolean[][], costUsd: number, extra: object = {}) => ({
    evalsId, startedAt: '', commit, skillsCommit: commit, uncommitted: [], costUsd, model: 'claude-sonnet-5-5',
    results: CASES.map((c, i) => {
      const runs = loaded[i].map((l) => ({ loaded: l, costUsd: costUsd / 27 }));
      return { ...c, runs, loaded: loaded[i].filter(Boolean).length, pass: runs.filter((r) => r.loaded === c.loads).length >= 2 };
    }),
    ...extra,
  });
  // The first run misses the skill once, on the timestamp bug: 2 of 3 still pass. A description for everything loads it every time.
  const expected = (flip: number[] = []) => CASES.map((c, i) => [0, 1, 2].map((r) => (flip.includes(i) ? !c.loads : !flip.length && i === 5 && r === 2 ? false : c.loads)));
  const FIRST = skillReport('20261017-101817', '42308f5', expected(), 5.18);
  const PROPOSAL = `## testing: say when the skill applies, not that it always does

**Why:** "Use for every task in this repository." loads the skill for a README typo, a Taskfile task and an
explanation: the 3 cases that shouldn't load it fail. The 2 that should load it still pass.

**Proposal:** name the work the skill is for, the way the other skills do:

\`description: Test-first Java coverage for src/**/*.java changes; use when the user adds or changes Java behavior, fixes a bug, or adds an endpoint.\``;
  const BROKEN = skillReport('20261017-104502', '42308f5', expected([6, 7, 8]), 5.31, { uncommitted: ['.agents/skills/testing/SKILL.md'], proposals: PROPOSAL });

  // Runs the skill-loaded evals frame by frame: the progress, then (if any failed) the improve agent
  const runSkills = (sc: Scene, evalsId: string, report: any, caption: string) => {
    const workflowId = `skill-loaded-evals-${evalsId}`;
    const asExpected = report.results.flatMap((r: any) => r.runs.map((run: any) => run.loaded === r.loads));
    for (const done of [0, 3, 8, 14, 19, 24, 27]) {
      const status = { evalsId, step: 'running', runs: 27, done, asExpected: asExpected.slice(0, done).filter(Boolean).length, costUsd: (report.costUsd * done) / 27 };
      sc.s = { ...sc.s, skillLoadedEvals: { workflowId, status } };
      sc.show(done ? 700 : 1600, { key: done ? undefined : '⏎', spin: 2, caption });
      sc.ui.message = undefined;
    }
    if (report.proposals) {
      const status = { evalsId, step: 'writing proposals', runs: 27, done: 27, asExpected: asExpected.filter(Boolean).length, costUsd: report.costUsd };
      sc.s = { ...sc.s, skillLoadedEvals: { workflowId, status } };
      sc.show(400, { spin: 10, caption: 'Cases failed: the improve agent writes proposals' });
    }
    sc.s = { ...sc.s, skillLoadedEvals: undefined, skillReports: [...sc.s.skillReports, report] };
  };
  const startDialog = (sc: Scene, uncommitted: string[] = []) => {
    sc.ui.dialog = { kind: 'startEvals', tasks: [], cursor: 0, uncommitted, evalReports: sc.s.evalReports, skills: SKILLS, skillReports: sc.s.skillReports };
  };

  // ── 1. The skill-loaded evals ───────────────────────────────────────────────────────────────────
  {
    const sc = new Scene(snap({}));
    sc.show(1400, { caption: 'Nothing runs yet' });
    sc.ui.view = 'board';
    sc.show(900, { key: 'Tab' });
    sc.ui.view = 'evals';
    sc.ui.evalsTabs = true;
    sc.show(2400, { key: 'Tab', caption: 'This branch has .harness/evals/: the Evals tab' });
    sc.ui.evalsKind = 'skillLoaded';
    sc.show(2400, { key: '→', caption: '→ switches to the skill-loaded evals' });
    startDialog(sc);
    sc.show(5500, { key: 's', caption: 's: every case 3 times, 27 runs. The first time, the cost is unknown' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started skill-loaded-evals-20261017-101817: 27 runs.';
    runSkills(sc, '20261017-101817', FIRST, '⏎ starts them, all 27 at once');
    sc.show(3500, { caption: 'Every case passes: one row per case, ✓ per run that did what it expects' });
    sc.ui.evalsTabs = false;
    sc.ui.evalsRun = 17;
    sc.show(2200, { key: '↓', caption: 'The arrows pick a run' });
    sc.ui.dialog = { kind: 'skillLoadedEvalRun', result: FIRST.results[5], run: 3 };
    sc.show(4500, { key: '⏎', caption: '⏎ shows what the run did: 2 of 3 is still a pass' });
    sc.ui.dialog = undefined;
    sc.show(1200, { key: 'Esc' });
    out('lab13-skills', sc);
  }

  // ── 2. A description too broad, and the improve agent's proposal ─────────────────────────────────
  {
    const sc = new Scene(snap({ skillReports: [FIRST] }));
    sc.ui.view = 'evals';
    sc.ui.evalsKind = 'skillLoaded';
    sc.ui.evalsTabs = true;
    sc.show(1800, { caption: 'testing now says: Use for every task in this repository.' });
    startDialog(sc, ['.agents/skills/testing/SKILL.md']);
    sc.show(5500, { key: 's', caption: 'Not committed, but checked as it is. The cost, by the last run' });
    sc.ui.dialog = undefined;
    sc.ui.message = 'Started skill-loaded-evals-20261017-104502: 27 runs.';
    runSkills(sc, '20261017-104502', BROKEN, '⏎: the same 27 runs, on the new description');
    sc.show(4000, { caption: '6 of 9: the cases that shouldn\'t load testing fail' });
    sc.ui.dialog = { kind: 'proposals', sections: [{ title: 'Skill loaded, 10-17 10:45', text: PROPOSAL }], scroll: 0 };
    sc.show(6500, { key: 'p', caption: 'p shows what the improve agent proposes. You decide' });
    sc.ui.dialog = undefined;
    sc.show(1200, { key: 'Esc' });
    out('lab13-proposals', sc);
  }

  // ── 3. The end-to-end evals: the start dialog, and one of our runs ───────────────────────
  {
    const sc = new Scene(snap({ skillReports: [FIRST] }));
    sc.ui.view = 'evals';
    sc.ui.evalsKind = 'skillLoaded';
    sc.ui.evalsTabs = true;
    sc.show(1200);
    sc.ui.evalsKind = 'e2e';
    sc.show(2600, { key: '←', caption: '← switches to the end-to-end evals' });
    sc.ui.dialog = { kind: 'startEvals', tasks: TASKS, cursor: 0, uncommitted: [], evalReports: [] };
    sc.show(4500, { key: 's', caption: '5 tasks, 3 runs each, through the whole pipeline' });
    sc.ui.dialog = { ...sc.ui.dialog, cursor: 4 };
    sc.show(3500, { key: '↓', caption: 'Or one task, 3 runs. Ours cost $5 to $16' });
    sc.ui.dialog = undefined;
    sc.show(3000, { key: 'Esc', caption: 'Esc: don\'t start it without (almost) unlimited credits' });
    out('lab13-e2e-start', sc);
  }

  // One of our end-to-end evals: 5 tasks, 3 runs each, 8 of 15 accepted, $58.64
  {
    const accepted = 'the tests pass with the hidden ones, and the grader approves it';
    const reviewed = (why: string) => `nothing was merged: the review approved no branch: agent/ticket-1: REJECT: ${why}`;
    const ROUNDING = 'averageDelayMinutes is rounded half up to one decimal, a rule nobody asked for';
    const GRADING = `The endpoint answers the request, and its tests cover the filter and the empty result.

But averageDelayMinutes is rounded half up to one decimal: 10, 10 and 15 minutes give 11.7. The request
asks for the average delay, and nothing about rounding. The research added the rule as an assumption, and
everything after it built on it.

REJECT: ${ROUNDING}`;
    const RUNS: [string, boolean, number, number, string, string?][] = [
      ['airline-delay-summary', false, 6.47, 30, `the grader rejects it: ${ROUNDING}`, GRADING],
      ['airline-delay-summary', false, 4.83, 22, `the grader rejects it: ${ROUNDING}`],
      ['airline-delay-summary', false, 5.2, 22, reviewed("no test tells a flight's latest delay event from an earlier one")],
      ['airport-departures', true, 5.19, 25, accepted],
      ['airport-departures', false, 6.49, 32, reviewed('change-quality item 2 (Tests): no test for a blank airport code')],
      ['airport-departures', false, 1.93, 7, reviewed('the new {code} path parameter is never tested blank')],
      ['delays-csv', false, 1.26, 5, reviewed("change-quality item 4 (Fit): the row-order test doesn't follow the existing tests")],
      ['delays-csv', true, 6.25, 35, accepted],
      ['delays-csv', true, 2.41, 11, accepted],
      ['min-delay-filter', true, 1.48, 6, accepted],
      ['min-delay-filter', true, 1.99, 8, accepted],
      ['min-delay-filter', true, 2.31, 10, accepted],
      ['status-filter', false, 1.77, 7, reviewed("Fit: the bad request for an unknown status doesn't use the codebase's error handling")],
      ['status-filter', true, 4.91, 24, accepted],
      ['status-filter', true, 6.15, 30, accepted],
    ];
    const models = { research: 'claude-opus-5-5', plan: 'claude-opus-5-5', implement: 'claude-sonnet-5-5', judge: 'claude-opus-5-5', review: 'claude-opus-5-5', grader: 'claude-opus-5-5' };
    const runs = RUNS.map(([task, ok, costUsd, min, reason, grading], i) => ({
      task, run: (i % 3) + 1, accepted: ok, reason, grading, costUsd, durationS: min * 60, step: 'done',
      merged: ok || reason.startsWith('the grader') ? ['agent/ticket-1'] : [], skillsCommit: 'cfdec82', harnessCommit: 'cfdec82', models,
    }));
    const PROPOSALS = `# Improvement proposals

8 of 15 runs were accepted, and only 1 of 15 was right the first time. The judge cost $28.45 of the $58.64.

## 1. Research may not add rules to a value the request defines

**Why:** All 3 airline-delay-summary runs added "rounded half up to one decimal" to the average. It caused
both grading rejections. The research judge passed it each time, and so did the review, because the ticket
said so. The research skill says "make and state a sensible assumption", and the agents used that to add a
rule instead of settling an open question.

**Change:** in the judge skill's research checks: no assumption or criterion changes a value the request
defines (rounding, truncation, clamping, defaults). One that does is scope added beyond the request.`;
    const REPORT = {
      evalsId: '20261017-102224', startedAt: '', commit: 'cfdec82', skillsCommit: 'cfdec82', harnessCommit: 'cfdec82',
      tasks: TASKS.map((t) => t.id), runs, models, quality: { accepted: 8, of: 15 }, reliability: { tasks: 1, of: 5 },
      firstTimeRight: { runs: 1, of: 15 }, costUsd: 58.64, costPerAccepted: 58.64 / 8, proposals: PROPOSALS,
      costByRole: { research: 4.78, plan: 3.13, implement: 16.1, judge: 28.45, review: 4.16, grader: 2.02 },
    };

    const sc = new Scene(snap({ skillReports: [FIRST] }));
    sc.ui.view = 'evals';
    sc.ui.evalsKind = 'e2e';
    sc.ui.evalsTabs = true;
    // While it runs: at most 3 runs at the same time, each through the whole pipeline
    const progress = (doneCount: number, working: number[], grading: number[] = []) => ({
      workflowId: 'evals-20261017-102224',
      status: {
        evalsId: '20261017-102224',
        costUsd: runs.slice(0, doneCount).reduce((sum, r) => sum + r.costUsd, 0) + working.length * 1.2,
        runs: runs.map((r, i) => ({
          task: r.task, run: r.run,
          state: i < doneCount ? 'done' : grading.includes(i) ? 'grading' : working.includes(i) ? 'running' : 'waiting',
          ...(i < doneCount ? { accepted: r.accepted, costUsd: r.costUsd } : {}),
        })),
      },
      runs: [],
    });
    for (const [doneCount, working, grading] of [[0, [0, 1, 2]], [1, [1, 2, 3]], [3, [3, 4, 5], [3]], [7, [7, 8, 9], [8]], [12, [12, 13, 14], [14]]] as [number, number[], number[]?][]) {
      sc.s = { ...sc.s, evals: progress(doneCount, working, grading) };
      sc.show(1800, { spin: 3, caption: 'One of our end-to-end evals: 15 runs, at most 3 at the same time, about 18 minutes each' });
    }
    sc.s = { ...sc.s, evals: undefined, evalReports: [REPORT] };
    sc.show(5500, { caption: '8 of 15 accepted, 1 task reliable, $7.33 per accepted change' });
    sc.ui.evalsTabs = false;
    sc.ui.evalsRun = 0;
    sc.show(2200, { key: '↓', caption: 'Why wasn\'t this one accepted?' });
    sc.ui.dialog = { kind: 'evalsRun', run: runs[0] };
    sc.show(6500, { key: '⏎', caption: 'The grader, with the hidden criteria' });
    sc.ui.dialog = { kind: 'proposals', sections: [{ title: 'E2E, 10-17 10:22', text: PROPOSALS }], scroll: 0 };
    sc.show(7000, { key: 'p', caption: 'What the improve agent proposes for the whole setup' });
    sc.ui.dialog = undefined;
    sc.show(1200, { key: 'Esc' });
    out('lab13-e2e-results', sc);
  }
}

for (const [name, scene] of scenes) write(name, scene);
