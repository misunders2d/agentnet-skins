import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {test} from 'node:test';

const require = createRequire(import.meta.url);
const source = new URL('../skins/holonet/src/assistant-setup.mjs', import.meta.url);
const chromiumPath = process.env.AGENTNET_CHROMIUM;

test('Holonet sets up Antigravity without requesting a native hook', {skip: !chromiumPath}, async t => {
  const {chromium} = require(process.env.AGENTNET_PLAYWRIGHT || 'playwright');
  const browser = await chromium.launch({headless: true, executablePath: chromiumPath});
  t.after(() => browser.close());

  const sources = [['Holonet', source]];
  if (process.env.AGENTNET_LEGACY_SETUP) sources.push(['Legacy', process.env.AGENTNET_LEGACY_SETUP]);
  for (const [name, file] of sources) {
    const module = 'data:text/javascript;base64,' + (await readFile(file)).toString('base64');
    for (const mixed of [false, true]) await t.test(name + (mixed ? ' with Claude selected' : ' Antigravity only'), async () => {
      const page = await browser.newPage({viewport: {width: mixed ? 390 : 1280, height: 844}});
      try {
        await page.setContent('<main></main>');
        await page.evaluate(async ({module, mixed}) => {
          const {mountAssistantSetup} = await import(module);
          const harnesses = [
            {id: 'agy', label: 'Antigravity', detected: true, supported: false, state: 'unsupported'},
            {id: 'claude', label: 'Claude', detected: true, supported: true, state: 'detected'},
            {id: 'other', label: 'Unavailable', detected: true, supported: false, state: 'unsupported'},
          ];
          const calls = [];
          window.setupCalls = calls;
          let agents = [];
          await mountAssistantSetup({
            root: document.querySelector('main'),
            async api(path, body) {
              if (path.startsWith('/api/folders')) return {path: '/fixture', dirs: []};
              if (path === '/api/assistant-setup') {
                if (body) {
                  calls.push(body);
                  if (!mixed || body.harnesses.join(',') !== 'claude') throw Error('Unexpected native hook request');
                }
                return {local: true, harnesses, review_id: body?.action === 'review' ? 'review-token' : undefined};
              }
              if (path !== '/api/agents') throw Error('Unexpected API path');
              if (body) calls.push(body);
              if (body?.action === 'create') {
                const agent = {record: {id: body.harness, label: body.label}, enabled: true, responder: {harness: body.harness, dir: body.dir}};
                agents = [...agents, agent];
                return {saved: true, agent};
              }
              if (body?.action === 'publish') return {published: true};
              return {agents, harnesses: [{name: 'agy', found: true}]};
            },
          });
        }, {module, mixed});
        await page.getByRole('button', {name: 'Use AgentNet inside your tools'}).click();
        assert.equal(await page.getByRole('checkbox', {name: 'Connect Unavailable'}).isDisabled(), true);
        const agy = page.getByRole('checkbox', {name: 'Connect Antigravity'});
        await agy.check();
        await page.getByText('Agent available', {exact: true}).waitFor();
        assert.equal(await agy.isChecked(), true);
        if (mixed) await page.getByRole('checkbox', {name: 'Connect Claude'}).check();

        if (name === 'Holonet') {
          await page.getByRole('button', {name: 'Choose working folder for Antigravity'}).click();
          await page.getByRole('button', {name: 'Use this folder'}).click();
        } else {
          await page.getByRole('textbox', {name: 'Antigravity working folder'}).fill('/fixture');
        }
        await page.getByRole('button', {name: 'Review changes'}).click();
        await page.getByText('Create assistant: Antigravity', {exact: true}).waitFor();
        await page.getByRole('button', {name: 'Confirm setup'}).click();
        await page.getByRole('heading', {name: 'Setup result'}).waitFor();
        const expected = mixed ? [
          {action: 'review', harnesses: ['claude']},
          {action: 'apply', harnesses: ['claude'], review_id: 'review-token'},
        ] : [];
        expected.push({action: 'create', label: 'Antigravity', harness: 'agy', dir: '/fixture'}, {action: 'publish'});
        assert.deepEqual(await page.evaluate(() => window.setupCalls), expected);
      } finally {
        await page.close();
      }
    });
  }
});
