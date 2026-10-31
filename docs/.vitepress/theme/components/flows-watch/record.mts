// Takes the screenshots that <FlowsWatch> shows in Labs 9 to 13, of the real page of `flows watch`: the page's own
// server and files, fed scripted snapshots instead of Temporal, clicked through in Chrome. Each lab is shot with
// the `flows watch` of its own branch of Zuehlke/ai-augmented-software-engineering. Run it again when the page
// changes there (in docs/, after npm install; it needs Google Chrome, or CHROME=<path>):
//
//   git worktree add /tmp/lab-10 lab/ralph-loop && (cd /tmp/lab-10/.harness && npm ci)
//   /tmp/lab-10/.harness/node_modules/.bin/tsx .vitepress/theme/components/flows-watch/record.mts /tmp/lab-10/.harness/src 10
//
// Lab 9 is lab/durable-workflows, Lab 10 lab/ralph-loop, Lab 11 lab/parallelizing-work, Lab 12 lab/orchestration,
// Lab 13 lab/evals. It writes <scene>-<n>-light.webp and -dark.webp per shot, and the shots' captions, what they
// mark to click next and where the parts are that a note can point at, into scenes.json.
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer, { type Page } from 'puppeteer-core';

const srcDir = path.resolve(process.argv[2]);
const lab = process.argv[3];
const BRANCH = ({ '9': 'lab/durable-workflows', '10': 'lab/ralph-loop', '11': 'lab/parallelizing-work', '12': 'lab/orchestration', '13': 'lab/evals' } as Record<string, string>)[lab];
if (!BRANCH) throw new Error('Which lab? 9, 10, 11, 12 or 13');
const outDir = path.dirname(fileURLToPath(import.meta.url));
const { handler } = await import(path.join(srcDir, 'web/server.ts'));
const { pageState } = await import(path.join(srcDir, 'web/state.ts'));

// Wide enough for Lab 12's nine boxes without scrolling
const VIEWPORT = { width: 1360, height: 780, deviceScaleFactor: 1.5 };
const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

type Snapshot = any;
type Rect = [number, number, number, number]; // x, y, w, h in % of the screenshot

interface Shot {
  s: Snapshot;
  caption: string;
  do?: (p: Act) => Promise<void>; // what happens on the page before the screenshot
}

const buttonNamed = (label: string) =>
  `::-p-xpath(//dialog[@open]//button[normalize-space()="${label}"] | //body[not(.//dialog[@open])]//button[normalize-space()="${label}"])`;

// What a shot can do on the page, and what it marks as the next thing to click
class Act {
  click?: Rect; // what to click next
  constructor(public page: Page, private set: (s: Snapshot) => void) {}
  private async rect(selector: string): Promise<Rect> {
    const el = await this.page.waitForSelector(selector, { visible: true });
    const b = (await el!.boundingBox())!;
    return [(b.x / VIEWPORT.width) * 100, (b.y / VIEWPORT.height) * 100, (b.width / VIEWPORT.width) * 100, (b.height / VIEWPORT.height) * 100];
  }
  async clickOn(selector: string) {
    await this.page.click(selector);
    await this.settle();
  }
  // A button by its label, in the dialog if one is open
  async button(label: string) {
    await this.clickOn(buttonNamed(label));
  }
  // Marks what to click next in the screenshot
  async mark(selector: string) {
    this.click = await this.rect(selector);
  }
  async markButton(label: string) {
    await this.mark(buttonNamed(label));
  }
  async type(selector: string, text: string) {
    await this.page.type(selector, text, { delay: 0 });
  }
  async hover(selector: string) {
    await this.page.hover(selector);
    await this.settle();
  }
  // The state the server answers from now on, for example after a click that starts something
  then(s: Snapshot) {
    this.set(s);
  }
  async settle(ms = 350) {
    await new Promise((r) => setTimeout(r, ms));
  }
}

// ── The data the scenes share ──────────────────────────────────────────────────────────────────────

const task = (n: number, title: string, status: string, blockedBy: string[] = []) => ({ id: `TASK-${n}`, title, status, blockedBy });
const TASK_TITLES = ['Normalize delay data model', 'Airline overview dashboard', 'Flight status lookup', 'Airport reference enrichment for flight status'];
const backlog = (...statuses: string[]) => statuses.map((st, i) => task(i + 1, TASK_TITLES[i], st, i === 3 ? ['TASK-3'] : []));
const REQUEST =
  'On the dashboard, support staff enter an airport code and see the delayed flights departing from it, with their delay. The dashboard also shows the airlines with the most delayed flights right now, without any search.';
const CSV_REQUEST = 'Support staff want to download the current delays as a CSV file to open in a spreadsheet, optionally only the flights of one airline.';

// What the pipeline's agents cost by each step, about what our runs cost with two tasks
const COST: Record<string, number> = {
  researching: 0.45, 'waiting for your specification approval': 0.55, designing: 0.8, planning: 1.2,
  'waiting for your plan approval': 1.85, implementing: 1.85, reviewing: 5.9, 'waiting for your merge decision': 6.5, merging: 6.5, done: 6.5,
};
const status = (step: string, extra: object = {}) => ({
  step, costUsd: COST[step], into: BRANCH, tasks: [], unfinished: [], review: '', approvedBranches: [], merged: [], notMerged: [], ...extra,
});
const pipeline = (step: string, extra: object = {}, state = 'running') => ({ workflowId: 'pipeline', state, status: status(step, extra) });
const snap = (extra: Partial<Snapshot>): Snapshot => ({
  temporal: true, worker: true, loops: [], others: [], backlog: backlog('done', 'done', 'done', 'blocked'), log: [],
  evalReports: [], skillReports: [], withoutEvals: lab !== '13', ...extra,
});
// A task's file, as /api/task gives it, with what you can do with it now
const TASK_FILES: Record<string, string> = {};
function taskView(s: Snapshot, id: string) {
  const t = s.backlog.find((b: any) => b.id === id);
  if (!t) return undefined;
  const loop = s.loops.find((l: any) => l.task === id);
  const own = loop?.workflowId === `ralph-${id}`;
  const busy = loop && (loop.state === 'running' || loop.state === 'you');
  return {
    ...t,
    content: TASK_FILES[id] ?? `---\nid: ${id}\nstatus: ${t.status}\n---\n\n# ${t.title}\n`,
    branch: `agent/${id.toLowerCase()}`,
    worktree: `.harness/worktrees/${id.toLowerCase()}`,
    start: t.status === 'ready' && !busy,
    merge: loop?.state === 'done' && loop.merged === false,
    discard: own && !busy && loop.merged !== true,
  };
}

const scenes: Record<string, Shot[]> = {};
const scene = (name: string, shots: Shot[]) => (scenes[name] = shots);

// ── Lab 9: the research agent, started from the page ──────────────────────────────────────────────
if (lab === '9') {
  const working = [
    '[pipeline] == research: claude',
    '[pipeline] Reading the research skill and the feature request',
    '[pipeline] Looking at GET /delays and its airline filter',
    '[pipeline] Wrote specs/delays-csv-export/specification.md',
  ];
  const judged = [...working, '[pipeline] == judge research: claude', '[pipeline] PASS'];
  const waiting = snap({ pipeline: pipeline('waiting for your specification approval', { specification: 'specs/delays-csv-export/specification.md' }), log: judged });

  scene('lab9-watch', [
    { s: snap({}), caption: 'Nothing runs yet: the pipeline, the loops, the worker output' },
    { s: snap({}), caption: 'Hover over a part to see the command behind it', do: (p) => p.hover('#box-0') },
  ]);
  scene('lab9-research', [
    { s: snap({}), caption: 'Click Research, paste the feature request, and start the pipeline', do: async (p) => { await p.clickOn('#box-0'); await p.type('#request', CSV_REQUEST); await p.markButton('Start the pipeline'); } },
    { s: snap({ pipeline: pipeline('researching'), log: working.slice(0, 3) }), caption: 'The research agent writes the specification' },
    { s: snap({ pipeline: pipeline('researching', { judging: true }), log: [...working, '[pipeline] == judge research: claude'] }), caption: 'Its judge checks it' },
  ]);
  scene('lab9-specification', [
    { s: waiting, caption: 'The pipeline waits for your approval', do: (p) => p.markButton('Decide') },
    { s: waiting, caption: 'Decide shows where the specification is. Leave it waiting', do: async (p) => { await p.button('Decide'); await p.markButton('Later'); } },
    { s: snap({ temporal: false, worker: false, log: judged }), caption: 'task flows:stop: Temporal and the worker are gone' },
    { s: waiting, caption: 'task flows:start: the pipeline still waits, at the same step' },
  ]);
}

// ── Lab 10: one Ralph loop ───────────────────────────────────────────────────────────────────────
if (lab === '10') {
  const BACKLOG = backlog('ready', 'blocked', 'blocked', 'blocked');
  TASK_FILES['TASK-1'] = `---
id: TASK-1
status: ready
---

# Normalize delay data model

Delay data is restructured from a single flat table into separate airline, flight, and delay-event data, so airline-level and flight-level questions can be answered correctly and efficiently instead of by scanning one flat table.

## Acceptance Criteria

- Airline data (code, name) is stored and queryable independently of individual delay records.
- Flight data (flight id, airline, departure/arrival airport codes, schedule) is stored and queryable independently of individual delay records.
- Delay/status events (on time / delayed / cancelled, delay minutes, timestamp) are stored linked to a specific flight, with multiple events per flight supported.
`;
  const loop = (o: object = {}) => [{ workflowId: 'ralph-TASK-1', task: 'TASK-1', state: 'running', run: 1, ...o }];
  const L = '[ralph-TASK-1]';
  const QUESTION = 'Replace the flat flights table now, or keep it until TASK-4?';
  const ANSWER = 'Keep the flat flights table until TASK-4.';
  const oneRun = [`${L} == implement: claude`, `${L} Added the airlines table, filled from the AIRLINE values`, `${L} Committed: Store airlines apart from delays`, `${L} Tests pass`];
  const steps = [
    `${L} == implement: claude`, `${L} Committed: Store flights apart from delays`, `${L} == judge implement: claude`, `${L} PASS`,
    `${L} == implement: claude`, `${L} Committed: Link delay events to flights`, `${L} == judge implement: claude`, `${L} RETRYABLE: the migration loses the delays of cancelled flights`,
    `${L} == implement: claude`, `${L} Committed: Keep the delays of cancelled flights`, `${L} == judge implement: claude`, `${L} AMBIGUOUS: ${QUESTION}`,
  ];
  const asking = snap({ backlog: BACKLOG, loops: loop({ run: 3, state: 'you', question: QUESTION }), log: steps });

  scene('lab10-one-run', [
    { s: snap({ backlog: BACKLOG }), caption: 'Implement a task…: one run on TASK-1', do: async (p) => { await p.clickOn('#implement'); await p.markButton('One run'); } },
    { s: snap({ backlog: BACKLOG, loops: loop(), log: oneRun.slice(0, 3) }), caption: 'One run: the agent takes one step and commits' },
    { s: snap({ backlog: BACKLOG, loops: loop({ judging: true }), log: [...oneRun, `${L} == judge implement: claude`] }), caption: 'Then the judge checks it' },
    { s: snap({ backlog: BACKLOG, loops: loop({ state: 'stopped' }), log: [...oneRun, `${L} == judge implement: claude`, `${L} PASS`] }), caption: 'After one run, the loop stops' },
  ]);
  scene('lab10-discard', [
    { s: snap({ backlog: BACKLOG, loops: loop({ state: 'stopped' }) }), caption: 'Click the loop: its task, and what you can do with it', do: async (p) => { await p.clickOn('[data-loop="0"]'); await p.markButton('Throw away'); } },
    { s: snap({ backlog: BACKLOG, loops: loop({ state: 'stopped' }) }), caption: 'Throw away removes its worktree and branch', do: async (p) => { await p.clickOn('[data-loop="0"]'); await p.button('Throw away'); await p.markButton('Throw away'); } },
    { s: snap({ backlog: BACKLOG, loops: loop({ state: 'stopped' }) }), caption: 'The next run starts fresh', do: async (p) => { await p.clickOn('[data-loop="0"]'); await p.button('Throw away'); p.then(snap({ backlog: BACKLOG })); await p.button('Throw away'); await p.settle(1800); } },
  ]);
  scene('lab10-loop', [
    { s: snap({ backlog: BACKLOG }), caption: 'Implement a task…: loop until TASK-1 is done', do: async (p) => { await p.clickOn('#implement'); await p.markButton('Loop until done'); } },
    { s: snap({ backlog: BACKLOG, loops: loop({ run: 2, judging: true }), log: steps.slice(0, 7) }), caption: 'Each run does one step, the judge checks it' },
    { s: asking, caption: 'The judge asks you a question', do: (p) => p.markButton('Answer') },
    { s: asking, caption: 'Answer, and the next run gets it', do: async (p) => { await p.button('Answer'); await p.type('#answer', ANSWER); await p.markButton('Send'); } },
    { s: asking, caption: 'The loop goes on', do: async (p) => { await p.button('Answer'); await p.type('#answer', ANSWER); p.then(snap({ backlog: BACKLOG, loops: loop({ run: 4 }), log: [...steps, `${L} == implement: claude`] })); await p.button('Send'); await p.settle(1800); } },
  ]);
  const done = snap({ backlog: BACKLOG, loops: loop({ state: 'done', run: 6, merged: false }), log: [`${L} == judge implement: claude`, `${L} PASS`, `${L} TASK-1 is done`] });
  scene('lab10-merge', [
    { s: done, caption: 'The task is done: its loop waits for you', do: (p) => p.mark('[data-loop="0"]') },
    { s: done, caption: 'Merge into your branch brings its commits onto your branch', do: async (p) => { await p.clickOn('[data-loop="0"]'); await p.markButton('Merge into your branch'); } },
  ]);
}

// ── Lab 11: two loops at the same time ───────────────────────────────────────────────────────────
if (lab === '11') {
  const BACKLOG = backlog('done', 'ready', 'ready', 'blocked');
  const loopOf = (n: number, o: object = {}) => ({ workflowId: `ralph-TASK-${n}`, task: `TASK-${n}`, state: 'running', run: 1, ...o });
  const L2 = '[ralph-TASK-2]';
  const L3 = '[ralph-TASK-3]';
  const log = [
    `${L2} == implement: claude`, `${L3} == implement: claude`, `${L2} Added the airline search box to the dashboard`,
    `${L3} Added the flight number search box to the dashboard`, `${L2} Committed: Show an airline's name and its active flights`,
    `${L2} == judge implement: claude`, `${L3} Committed: Show a flight's status and delay`,
  ];
  const done = (n: number, run: number) => loopOf(n, { state: 'done', run, merged: false });
  scene('lab11-start', [
    { s: snap({ backlog: BACKLOG }), caption: 'Two ready tasks, independent of each other: a loop on TASK-2', do: async (p) => { await p.clickOn('#implement'); await p.markButton('Loop until done'); } },
    { s: snap({ backlog: BACKLOG, loops: [loopOf(2)] }), caption: 'The same for TASK-3', do: async (p) => { await p.clickOn('#implement'); await p.markButton('Loop until done'); } },
    { s: snap({ backlog: BACKLOG, loops: [loopOf(2, { judging: true }), loopOf(3)], log }), caption: 'Both loops run at the same time, the output mixes both' },
  ]);
  scene('lab11-cleanup', [
    { s: snap({ backlog: BACKLOG, loops: [done(2, 5), done(3, 6)] }), caption: 'Both loops are done, each on its own branch', do: (p) => p.mark('[data-loop="0"]') },
    { s: snap({ backlog: BACKLOG, loops: [done(2, 5), done(3, 6)] }), caption: 'Throw away removes its worktree and branch', do: async (p) => { await p.clickOn('[data-loop="0"]'); await p.button('Throw away'); await p.markButton('Throw away'); } },
    { s: snap({ backlog: BACKLOG }), caption: 'Both tasks are ready again' },
  ]);
}

// ── Lab 12: the pipeline ─────────────────────────────────────────────────────────────────────────
if (lab === '12') {
  const BACKLOG = [...backlog('done', 'done', 'done', 'blocked'), task(5, 'Delayed departures per airport on the dashboard', 'ready'), task(6, 'Airlines with the most delayed flights', 'ready')];
  const SPEC = { specification: 'specs/delayed-departures/specification.md' };
  const loop = (n: number, extra: object = {}) => ({ workflowId: `pipeline-TASK-${n}`, task: `TASK-${n}`, state: 'running', run: 1, ...extra });
  const loops = (a: object, b: object) => [loop(5, a), loop(6, b)];
  const review = 'Both branches meet their acceptance criteria and have tests for them.\nagent/task-5: APPROVE\nagent/task-6: APPROVE';
  const branches = ['agent/task-5', 'agent/task-6'];
  const tasks = ['TASK-5', 'TASK-6'];
  const FEEDBACK = 'Count only flights that are delayed by 15 minutes or more.';
  const researchLog = ['[pipeline] == research: claude', '[pipeline] Wrote specs/delayed-departures/specification.md', '[pipeline] == judge research: claude', '[pipeline] PASS'];
  const planLog = [...researchLog, '[pipeline] == design: claude', '[pipeline] Wrote specs/delayed-departures/design.md', '[pipeline] PASS', '[pipeline] == plan: claude', '[pipeline] Wrote backlog/TASK-5-delayed-departures.md', '[pipeline] Wrote backlog/TASK-6-most-delayed-airlines.md', '[pipeline] PASS'];
  const implLog = [...planLog, '[pipeline-TASK-5] == implement: claude', '[pipeline-TASK-6] == implement: claude', '[pipeline-TASK-5] Committed: List the delayed departures of an airport', '[pipeline-TASK-5] == judge implement: claude'];
  const waitSpec = snap({ pipeline: pipeline('waiting for your specification approval', SPEC), log: researchLog });
  const waitPlan = snap({ backlog: BACKLOG, pipeline: pipeline('waiting for your plan approval', { ...SPEC, tasks }), log: planLog });
  const implementing = snap({ backlog: BACKLOG, pipeline: pipeline('implementing', { ...SPEC, tasks }), loops: loops({ run: 2, judging: true }, { run: 2 }), log: implLog });
  const merging = { ...SPEC, tasks, review, approvedBranches: branches };
  const doneLoops = (merged: boolean) => loops({ state: 'done', run: 3, merged }, { state: 'done', run: 4, merged });
  const waitMerge = snap({ backlog: BACKLOG, pipeline: pipeline('waiting for your merge decision', merging), loops: doneLoops(false), log: [...implLog, '[pipeline] == review: claude', '[pipeline] agent/task-5: APPROVE', '[pipeline] agent/task-6: APPROVE'] });
  const DONE = BACKLOG.map((t) => (tasks.includes(t.id) ? { ...t, status: 'done' } : t));
  const merged = snap({ backlog: DONE, pipeline: pipeline('done', { ...merging, merged: branches, testsPass: true }, 'done'), loops: doneLoops(true), log: [...waitMerge.log, '[pipeline] Merged agent/task-5', '[pipeline] Merged agent/task-6', '[pipeline] Tests pass'] });

  scene('lab12-overview', [
    { s: snap({ pipeline: pipeline('researching'), log: researchLog.slice(0, 1) }), caption: 'The research agent writes a specification' },
    { s: waitSpec, caption: 'You approve the specification, or send it back' },
    { s: snap({ pipeline: pipeline('designing', SPEC), log: [...researchLog, '[pipeline] == design: claude'] }), caption: 'The design agent writes the design' },
    { s: snap({ pipeline: pipeline('planning', SPEC), log: [...researchLog, '[pipeline] == plan: claude'] }), caption: 'The plan agent cuts it into tasks' },
    { s: waitPlan, caption: 'You approve the plan and its tasks, or send it back' },
    { s: implementing, caption: 'One Ralph loop per task, in parallel' },
    { s: snap({ ...waitMerge, pipeline: pipeline('reviewing', { ...SPEC, tasks }) }), caption: 'The review agent reviews every branch' },
    { s: waitMerge, caption: 'You decide whether to merge' },
    { s: merged, caption: 'Merged onto your branch' },
  ]);
  scene('lab12-start', [
    { s: snap({}), caption: 'Click Research, paste the feature request, and start the pipeline', do: async (p) => { await p.clickOn('#box-0'); await p.type('#request', REQUEST); await p.markButton('Start the pipeline'); } },
    { s: snap({ pipeline: pipeline('researching'), log: researchLog.slice(0, 2) }), caption: 'The research agent writes the specification' },
    { s: snap({ pipeline: pipeline('researching', { judging: true }), log: researchLog.slice(0, 3) }), caption: 'Its judge checks it' },
    { s: waitSpec, caption: 'The specification waits for you', do: (p) => p.markButton('Decide') },
  ]);
  const revised = { ...SPEC, revised: { specification: 1 } };
  scene('lab12-specification', [
    { s: waitSpec, caption: 'Decide: approve it, or send it back', do: async (p) => { await p.button('Decide'); await p.markButton('Send back…'); } },
    { s: waitSpec, caption: 'Send back… with your feedback', do: async (p) => { await p.button('Decide'); await p.button('Send back…'); await p.type('#feedback', FEEDBACK); await p.markButton('Send back'); } },
    { s: snap({ pipeline: pipeline('researching', revised), log: [...researchLog, '[pipeline] == research: claude', '[pipeline] Revised specs/delayed-departures/specification.md'] }), caption: 'The research agent revises it' },
    { s: snap({ pipeline: pipeline('waiting for your specification approval', revised), log: [...researchLog, '[pipeline] == research: claude', '[pipeline] PASS'] }), caption: 'It asks you again: Approve, and the design agent goes on', do: async (p) => { await p.button('Decide'); await p.markButton('Approve'); } },
  ]);
  scene('lab12-approve', [
    { s: waitPlan, caption: 'The plan waits for you', do: (p) => p.markButton('Decide') },
    { s: waitPlan, caption: 'Approve the tasks to build, or send the plan back', do: async (p) => { await p.button('Decide'); await p.markButton('Approve'); } },
    { s: snap({ backlog: BACKLOG, pipeline: pipeline('implementing', { ...SPEC, tasks }), loops: loops({}, {}), log: [...planLog, '[pipeline-TASK-5] == implement: claude', '[pipeline-TASK-6] == implement: claude'] }), caption: 'Each approved task gets a Ralph loop' },
  ]);
  TASK_FILES['TASK-5'] = `---
id: TASK-5
status: ready
design: specs/delayed-departures/design.md
---

# Delayed departures per airport on the dashboard

On the dashboard, support staff enter an airport code and see the flights departing from it that are delayed, each with its delay.

## Acceptance Criteria

- The dashboard has a search box for an airport code.
- Submitting a code lists the delayed flights departing from it, with their delay in minutes, the longest delay first.
- An airport without delayed departures shows "No delayed departures", not an error.
`;
  scene('lab12-implement', [
    { s: implementing, caption: 'The loops, one per task', do: (p) => p.mark('[data-loop="0"]') },
    { s: implementing, caption: 'Click a loop to open its task', do: (p) => p.clickOn('[data-loop="0"]') },
  ]);
  scene('lab12-merge', [
    { s: waitMerge, caption: 'The review is done: the merge decision waits for you', do: (p) => p.markButton('Decide') },
    { s: waitMerge, caption: "Decide shows the review's verdict per branch", do: async (p) => { await p.button('Decide'); await p.markButton('Merge'); } },
    { s: merged, caption: 'Merged onto your branch, and the tests pass' },
  ]);
}

// ── Lab 13: the evals ────────────────────────────────────────────────────────────────────────────
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
  const DESCRIPTIONS = {
    'api-design': readSkillDescription('api-design'),
    testing: readSkillDescription('testing'),
  };
  const BROAD = 'Use for every task in this repository.';
  const TASKS = ['airline-delay-summary', 'airport-departures', 'delays-csv', 'min-delay-filter', 'status-filter'];

  // A skill-loaded evals: `loaded` per case, in which of its 3 runs the agent loaded the skill
  const skillReport = (evalsId: string, commit: string, loaded: boolean[][], costUsd: number, extra: object = {}) => ({
    evalsId, startedAt: '', commit, skillsCommit: commit, uncommitted: [], descriptions: DESCRIPTIONS, costUsd, model: 'claude-sonnet-5-5',
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
  const BROKEN = skillReport('20261017-104502', '42308f5', expected([6, 7, 8]), 5.31, {
    uncommitted: ['.agents/skills/testing/SKILL.md'], descriptions: { ...DESCRIPTIONS, testing: BROAD }, proposals: PROPOSAL,
  });
  // While it runs: the cases fill in as their runs finish
  const runningSkills = (report: any, done: number) => {
    let left = done;
    const cases = report.results.map((r: any) => ({ skill: r.skill, prompt: r.prompt, loads: r.loads, runs: r.runs.map((run: any) => (left-- > 0 ? run : null)) }));
    const asExpected = report.results.flatMap((r: any) => r.runs.map((run: any) => run.loaded === r.loads)).slice(0, done).filter(Boolean).length;
    return { workflowId: `skill-loaded-evals-${report.evalsId}`, status: { evalsId: report.evalsId, step: 'running', runs: 27, done, asExpected, costUsd: (report.costUsd * done) / 27, cases } };
  };
  const evalsTab = (p: Act) => p.clickOn('.tab[data-tab="evals"]');

  scene('lab13-skills', [
    { s: snap({}), caption: 'The Evals tab: Start skill-loaded evals runs every case 3 times', do: async (p) => { await evalsTab(p); await p.markButton('Start skill-loaded evals'); } },
    { s: snap({ skillLoadedEvals: runningSkills(FIRST, 14) }), caption: 'The cases fill in as their runs finish', do: evalsTab },
    { s: snap({ skillReports: [FIRST] }), caption: 'Every case passes: ✗ marks a run that did not do what its case expects', do: evalsTab },
  ]);
  scene('lab13-proposals', [
    { s: snap({ skillReports: [FIRST, BROKEN] }), caption: "6 of 9: the cases that shouldn't load testing fail", do: async (p) => { await evalsTab(p); await p.markButton('Read the proposal'); } },
    { s: snap({ skillReports: [FIRST, BROKEN] }), caption: 'What the improve agent proposes. You decide', do: async (p) => { await evalsTab(p); await p.button('Read the proposal'); } },
  ]);

  // One of our end-to-end evals: 5 tasks, 3 runs each, 8 of 15 accepted, $58.64
  const accepted = 'the tests pass with the hidden ones, and the grader approves it';
  const reviewed = (why: string) => `nothing was merged: the review approved no branch: agent/task-1: REJECT: ${why}`;
  const ROUNDING = 'averageDelayMinutes is rounded half up to one decimal, a rule nobody asked for';
  const GRADING = `The endpoint answers the request, and its tests cover the filter and the empty result.

But averageDelayMinutes is rounded half up to one decimal: 10, 10 and 15 minutes give 11.7. The request
asks for the average delay, and nothing about rounding. The research added the rule as an assumption, and
everything after it built on it.

REJECT: ${ROUNDING}`;
  const RUNS: [string, boolean, number, number, string, string[], string?][] = [
    ['airline-delay-summary', false, 6.47, 30, `the grader rejects it: ${ROUNDING}`, ['implement: no test for an airline without delays'], GRADING],
    ['airline-delay-summary', false, 4.83, 22, `the grader rejects it: ${ROUNDING}`, []],
    ['airline-delay-summary', false, 5.2, 22, reviewed("no test tells a flight's latest delay event from an earlier one"), ['implement: the step did two criteria']],
    ['airport-departures', true, 5.19, 25, accepted, ['implement: no test for a blank airport code']],
    ['airport-departures', false, 6.49, 32, reviewed('change-quality item 2 (Tests): no test for a blank airport code'), ['implement: no test for a blank airport code', 'implement: a test mirrors the code']],
    ['airport-departures', false, 1.93, 7, reviewed('the new {code} path parameter is never tested blank'), []],
    ['delays-csv', false, 1.26, 5, reviewed("change-quality item 4 (Fit): the row-order test doesn't follow the existing tests"), []],
    ['delays-csv', true, 6.25, 35, accepted, ['plan: one criterion in two tasks', 'implement: quoting is not tested']],
    ['delays-csv', true, 2.41, 11, accepted, ['implement: the header row is not tested']],
    ['min-delay-filter', true, 1.48, 6, accepted, []],
    ['min-delay-filter', true, 1.99, 8, accepted, ['implement: no test for a negative minimum']],
    ['min-delay-filter', true, 2.31, 10, accepted, ['implement: the step did two criteria']],
    ['status-filter', false, 1.77, 7, reviewed("Fit: the bad request for an unknown status doesn't use the codebase's error handling"), []],
    ['status-filter', true, 4.91, 24, accepted, ['research: the specification adds a sort order']],
    ['status-filter', true, 6.15, 30, accepted, ['implement: no test for an unknown status']],
  ];
  const models = { research: 'claude-opus-5-5', design: 'claude-opus-5-5', plan: 'claude-opus-5-5', implement: 'claude-sonnet-5-5', judge: 'claude-opus-5-5', review: 'claude-opus-5-5', grader: 'claude-opus-5-5' };
  const runs = RUNS.map(([taskId, ok, costUsd, min, reason, rejectedBecause, grading], i) => ({
    task: taskId, run: (i % 3) + 1, accepted: ok, reason, grading, costUsd, durationS: min * 60, step: 'done', rejectedBecause,
    merged: ok || reason.startsWith('the grader') ? ['agent/task-1'] : [], skillsCommit: 'cfdec82', harnessCommit: 'cfdec82',
  }));
  const PROPOSALS = `# Improvement proposals

8 of 15 runs were accepted, and only 1 of 15 was right the first time. The judge cost $28.45 of the $58.64.

## 1. Research may not add rules to a value the request defines

**Why:** All 3 airline-delay-summary runs added "rounded half up to one decimal" to the average. It caused
both grading rejections. The research judge passed it each time, and so did the review, because the task
said so. The research skill says "make and state a sensible assumption", and the agents used that to add a
rule instead of settling an open question.

**Change:** in the judge skill's research checks: no assumption or criterion changes a value the request
defines (rounding, truncation, clamping, defaults). One that does is scope added beyond the request.`;
  const REPORT = {
    evalsId: '20261017-102224', startedAt: '', commit: 'cfdec82', skillsCommit: 'cfdec82', harnessCommit: 'cfdec82',
    tasks: TASKS, runs, models, quality: { accepted: 8, of: 15 }, reliability: { tasks: 1, of: 5 },
    firstTimeRight: { runs: 1, of: 15 }, costUsd: 58.64, costPerAccepted: 58.64 / 8, proposals: PROPOSALS,
    costByRole: { research: 4.78, design: 2.1, plan: 3.13, implement: 16.1, judge: 28.45, review: 4.16, grader: 2.02 },
  };
  const e2e = async (p: Act) => { await evalsTab(p); await p.clickOn('[data-kind="e2e"]'); };
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
    runs: working.filter((i) => !grading.includes(i)).map((i) => ({ task: runs[i].task, run: runs[i].run, state: 'running', pipeline: status(i % 2 ? 'implementing' : 'planning'), loops: [] })),
  });
  scene('lab13-e2e-start', [
    { s: snap({ skillReports: [FIRST] }), caption: 'Start evals… picks all tasks, or one', do: async (p) => { await e2e(p); await p.button('Start evals…'); await p.mark('#evalsTask'); } },
  ]);
  scene('lab13-e2e-results', [
    { s: snap({ skillReports: [FIRST], evals: progress(7, [7, 8, 9], [8]) }), caption: 'One of our end-to-end evals: 15 runs, at most 3 at the same time', do: e2e },
    { s: snap({ skillReports: [FIRST], evalReports: [REPORT] }), caption: '8 of 15 accepted, 1 task reliable, $7.33 per accepted change', do: async (p) => { await e2e(p); await p.mark('[data-row="0"]'); } },
    { s: snap({ skillReports: [FIRST], evalReports: [REPORT] }), caption: 'Click a task: why each run was or was not accepted', do: async (p) => { await e2e(p); await p.clickOn('[data-row="0"]'); } },
    { s: snap({ skillReports: [FIRST], evalReports: [REPORT] }), caption: 'What the improve agent proposes for the whole setup', do: async (p) => { await e2e(p); await p.button('Read the proposals'); } },
  ]);
}

function readSkillDescription(skill: string): string {
  const file = path.join(srcDir, '../../.agents/skills', skill, 'SKILL.md');
  return /^description: (.*)$/m.exec(readFileSync(file, 'utf8'))?.[1] ?? '';
}

// ── Shooting ─────────────────────────────────────────────────────────────────────────────────────

let current: Snapshot = snap({});
// What the server says to an action, as actions.ts says it, for the toast
function said(a: any): string {
  const t = String(a.task ?? '').toLowerCase();
  switch (a.kind) {
    case 'start': return 'Started the pipeline.';
    case 'approveSpecification': return 'Approved. The design agent goes on.';
    case 'approvePlan': return `Approved: ${a.tasks.join(' ') || 'none'}`;
    case 'revise': return `Sent the ${a.on} back with your feedback.`;
    case 'decideMerge': return a.yes ? 'Merging.' : 'Not merged.';
    case 'answer': return 'Sent. The next run gets your answer.';
    case 'ralph': return a.runs === 1 ? `Started one run of ralph-${a.task}.` : `Started ralph-${a.task}.`;
    case 'discard': return `Threw away .harness/worktrees/${t} and agent/${t}.`;
    default: return 'Done.';
  }
}
const server = http.createServer(
  handler({
    state: () => pageState(current, BRANCH, 'claude', lab === '13' ? ['airline-delay-summary', 'airport-departures', 'delays-csv', 'min-delay-filter', 'status-filter'] : []),
    task: (id: string) => taskView(current, id),
    act: async (body: string) => said(JSON.parse(body)),
  }),
);
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;

// The parts a note can point at, in % of the screenshot
const ANCHORS: Record<string, string> = {
  temporal: '[data-cmd="task flows:start"]',
  worker: '[data-cmd="flows logs"]:not(#log)',
  map: '#map',
  stages: '#map .stage',
  steps: '#map .step',
  box: '#box-0',
  loops: '#loops',
  log: '#log',
  needs: '#needs',
};

const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, defaultViewport: VIEWPORT });
const index = existsSync(path.join(outDir, 'scenes.json')) ? JSON.parse(readFileSync(path.join(outDir, 'scenes.json'), 'utf8')) : {};
try {
  for (const [name, shots] of Object.entries(scenes)) {
    for (const f of readdirSync(outDir)) if (f.startsWith(`${name}-`) && f.endsWith('.webp')) rmSync(path.join(outDir, f));
    const out: { caption: string; click?: Rect; anchors?: Record<string, Rect> }[] = [];
    for (const [i, shot] of shots.entries()) {
      let click: Rect | undefined;
      let anchors: Record<string, Rect> | undefined;
      for (const theme of ['light', 'dark'] as const) {
        current = shot.s;
        const page = await browser.newPage();
        await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }, { name: 'prefers-reduced-motion', value: 'reduce' }]);
        await page.goto(url, { waitUntil: 'networkidle0' });
        await page.waitForFunction('state !== null');
        await page.mouse.move(VIEWPORT.width - 2, VIEWPORT.height - 2); // no tooltip unless a shot hovers
        await page.evaluate('{ const log = document.getElementById("log"); log.scrollTop = log.scrollHeight; }'); // the newest lines, as when it follows them
        const act = new Act(page, (s) => (current = s));
        await shot.do?.(act);
        await act.settle(500);
        await page.screenshot({ path: path.join(outDir, `${name}-${i + 1}-${theme}.webp`), type: 'webp', quality: 88 });
        click = act.click;
        anchors = await page.evaluate((sel: Record<string, string>, vw: number, vh: number) => {
          const r: Record<string, number[]> = {};
          for (const [k, s] of Object.entries(sel)) {
            const els = [...document.querySelectorAll(s)].filter((e) => (e as HTMLElement).offsetParent);
            if (!els.length) continue;
            const bs = els.map((e) => e.getBoundingClientRect());
            const x = Math.min(...bs.map((b) => b.left)), y = Math.min(...bs.map((b) => b.top));
            const x2 = Math.min(vw, Math.max(...bs.map((b) => b.right))), y2 = Math.min(vh, Math.max(...bs.map((b) => b.bottom)));
            r[k] = [(x / vw) * 100, (y / vh) * 100, ((x2 - x) / vw) * 100, ((y2 - y) / vh) * 100];
          }
          return r;
        }, ANCHORS, VIEWPORT.width, VIEWPORT.height) as Record<string, Rect>;
        await page.close();
      }
      out.push({ caption: shot.caption, ...(click ? { click } : {}), ...(i === shots.length - 1 ? { anchors } : {}) });
    }
    index[name] = out;
    console.log(name, out.length, 'shots');
  }
} finally {
  await browser.close();
  server.close();
}
const round = (_: string, v: unknown) => (typeof v === 'number' ? Math.round(v * 10) / 10 : v);
writeFileSync(path.join(outDir, 'scenes.json'), JSON.stringify(Object.fromEntries(Object.entries(index).sort()), round, 1) + '\n');
