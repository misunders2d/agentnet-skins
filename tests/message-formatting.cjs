// Production loader, pinned native provider and disposable seeded company.
// Touch selects a native textarea range programmatically, then uses real taps.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { chromium } = require(process.env.AGENTNET_PLAYWRIGHT || 'playwright');

const world = process.env.AGENTNET_SKIN_WORLD;
const evidence = process.env.AGENTNET_SKINS_EVIDENCE;
const { id } = JSON.parse(fs.readFileSync(path.join(process.env.AGENTNET_SKIN_PACKAGE, 'skin.json')));
const family = process.env.AGENTNET_SKIN_FAMILY;
const zoom = family === 'zoom';
const urls = JSON.parse(fs.readFileSync(path.join(world, 'urls.json')));
const conv = JSON.parse(fs.readFileSync(path.join(world, 'seed.json'))).dm_vitalii;
const pageURL = urls.sergey.page.match(/https?:\/\/[^\s]+/)[0];
const tag = 'Formatting ' + id + ' ' + Date.now().toString(36);
const secret = 'first private comet ' + id;
const revised = 'second private orbit ' + id;
const hidden = '[Hidden text]';
const localLimit = 1100;
const samples = {};
let browser, page, messageID;
const errors = [];

const settled = () => zoom ? page.locator('#zoom .zoom-layer:only-child').waitFor() : Promise.resolve();
const compose = () => page.locator(zoom ? '#write-body' : '#body');
const list = () => page.locator(zoom ? '#zoom .mini-chat' : '#timeline');
const preview = () => messageID ? list().locator('#' + messageID)
  : list().locator(zoom ? 'li.mc' : 'li.msg').filter({ hasText: tag });
const search = () => page.locator(zoom ? '.zoom-search' : '#search');
const formattingMenu = () => page.getByRole('menu', { name: 'Text formatting', exact: true });
const item = name => formattingMenu().getByRole('menuitem', { name, exact: true });
const quote = () => page.locator(zoom ? '#dialog .quote' : '#replying-text');
const screenshot = name => page.screenshot({ path: path.join(evidence, 'screenshots', id + '-format-' + name + '.png') });

async function timed(label, action, observed) {
  const start = performance.now();
  await action();
  if (observed) await observed();
  const duration = Math.round(performance.now() - start);
  samples[label] = Math.max(samples[label] || 0, duration);
  assert(duration < localLimit, label + ' took ' + duration + ' ms (bound ' + localLimit + ' ms)');
}

async function open(touch = false) {
  const context = await browser.newContext(touch
    ? { viewport: {width: 390, height: 620}, isMobile: true, hasTouch: true, reducedMotion: 'reduce' }
    : { viewport: {width: 1440, height: 900}, reducedMotion: 'reduce' });
  page = await context.newPage();
  page.setDefaultTimeout(12000);
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(pageURL);
  await page.goto(new URL('/?skin=' + id, pageURL).href);
  await page.getByRole('button', { name: 'Use this skin', exact: true }).click();
  await page.locator('.' + family + '-root').waitFor();
  const peer = await page.evaluate(async id => (await window.agentnet.api('/api/overview')).dms.find(chat => chat.id === id).peer.label, conv);
  await page.locator('#nav-chats').click();
  // Desktop: pressing the active Chats item hides the list column (MEL-824); press again to show it.
  if (!zoom && await page.locator('.side[data-hidden]').count()) await page.locator('#nav-chats').click();
  if (zoom) {
    await settled();
    await page.locator('#zoom .ladder .rung').first().click();
    await page.locator('#zoom .person-card').filter({ hasText: peer }).click();
  } else {
    await page.locator('#conv-list').getByText(peer, { exact: true }).first().click();
  }
  await list().waitFor();
  await settled();
  return context;
}

async function openCompose() {
  if (zoom) await page.getByRole('button', { name: 'Write in this DM…', exact: true }).click();
  await compose().waitFor();
  return compose();
}

async function select(field, word, direction = 'forward') {
  await field.evaluate((node, { word, direction }) => {
    const at = node.value.indexOf(word);
    if (at < 0) throw Error('Fixture selection missing: ' + word);
    node.focus();
    node.setSelectionRange(at, at + word.length, direction);
  }, { word, direction });
}

async function selection(field, expected, direction = 'forward') {
  assert.deepEqual(await field.evaluate(n => [
    n.getRootNode().activeElement === n, n.value.slice(n.selectionStart, n.selectionEnd), n.selectionDirection,
  ]), [true, expected, direction]);
}

async function pressFormat(field, keys, before, after, direction = 'forward') {
  await select(field, before, direction);
  const original = await field.inputValue();
  await timed('shortcut ' + keys, () => field.press(keys), async () => {
    assert.equal(await field.inputValue(), original.replace(before, after));
    await selection(field, before, direction);
  });
}

async function contextMenu(field) {
  await field.click({ button: 'right', position: {x: 22, y: 12} });
  await item('Formatting ›').waitFor();
}

async function send() {
  await page.locator(zoom ? '#dialog-ok' : '#send').click();
  if (zoom) await page.locator('#dialog').waitFor({ state: 'hidden' });
}

// First request can fail while local UI continues. A retry reaches the real
// provider using the captured body and identity.
async function holdFirst(pattern) {
  const posts = [];
  let release, arrived;
  const held = new Promise(resolve => { release = resolve; });
  const first = new Promise(resolve => { arrived = resolve; });
  const route = async req => {
    posts.push(req.request().postDataJSON());
    if (posts.length > 1) return req.continue();
    arrived();
    await held;
    return req.fulfill({ status: 503, json: { error: 'Fixture write unavailable' } });
  };
  await page.route(pattern, route);
  async function waitForFirst() {
    const timeout = AbortSignal.timeout(12000);
    await new Promise((resolve, reject) => {
      timeout.addEventListener('abort', () => reject(Error('Fixture did not intercept ' + pattern)), { once: true });
      first.then(resolve);
    });
  }
  return { posts, waitForFirst, release, stop: () => page.unroute(pattern, route) };
}

async function openMessage() {
  if (!zoom) return preview();
  await preview().locator('button.mc-bubble').click();
  await settled();
  return page.locator('.zoom-message');
}

async function edit(message, touch = false) {
  const activate = button => touch ? button.tap() : button.click();
  const actions = message.getByLabel('Message actions', { exact: true }).first();
  await activate(actions);
  if (zoom && touch) {
    const selector = '.zoom-layer:last-child .zoom-message > .msg-menu > summary';
    const menu = await page.evaluateHandle(async ({ selector, conv, body }) => {
      const root = document.querySelector('#skin').shadowRoot;
      const summary = root.querySelector(selector);
      if (!summary) throw Error('Expected the current message action trigger');
      const menu = summary.parentElement;
      summary.focus({ preventScroll: true });
      if (!menu.open || root.activeElement !== summary) {
        throw Error('Expected the open message action menu to have focus before the push');
      }
      await window.agentnet.api('/api/dm/send', { conv, body });
      return menu;
    }, { selector, conv, body: 'Update while message actions are open ' + tag });
    try {
      await page.waitForFunction(oldMenu => !oldMenu.isConnected, menu);
      // Look up the current control and read its focus in one browser task.
      const state = await page.evaluate(selector => {
        const root = document.querySelector('#skin').shadowRoot;
        const summary = root.querySelector(selector);
        return { open: summary?.parentElement.open, focused: root.activeElement === summary };
      }, selector);
      assert(state.open, 'message actions remain open after a background refresh');
      assert(state.focused, 'message action focus survives the refresh');
    } finally { await menu.dispose(); }
  }
  await activate(message.getByRole('button', { name: 'Edit', exact: true }));
  return message.getByRole('textbox', { name: 'New text' });
}

async function assertMask(target, word) {
  const text = await target.textContent();
  assert(text.includes(hidden), 'Expected a spoiler placeholder');
  assert(!text.includes(word), 'Hidden text present before reveal');
  assert.equal(await target.evaluate((node, value) => [...node.querySelectorAll('[title], [aria-label], a[href]')]
    .some(child => ['title', 'aria-label', 'href'].some(name => child.getAttribute(name)?.includes(value))), word), false);
}

async function reveal(message, word, action, prefix) {
  const spoiler = message.getByRole('button', { name: hidden, exact: true });
  await timed(prefix + ' reveal', () => action(spoiler), async () => {
    await message.getByRole('button', { name: word, exact: true, pressed: true }).waitFor();
  });
}

async function desktop() {
  const context = await open();
  try {
    const field = await openCompose();
    await field.fill('sample');
    await select(field, 'sample', 'backward');
    await timed('desktop context menu', () => contextMenu(field));
    await timed('desktop submenu', () => item('Formatting ›').press('ArrowRight'), () => item('Bold').waitFor());
    assert.deepEqual(await formattingMenu().getByRole('menuitem').allTextContents().then(rows =>
      rows.map(row => row.replace(/(?:Ctrl\+|⌘).*$/, ''))),
    ['Bold', 'Italic', 'Underline', 'Strikethrough', 'Monospace', 'Quote', 'Hidden text', 'Link', 'Clear formatting']);
    await screenshot('desktop-menu');
    await timed('desktop menu action', () => item('Bold').click(), async () => {
      assert.equal(await field.inputValue(), '**sample**');
      await selection(field, 'sample', 'backward');
    });
    await select(field, '**sample**');
    await timed('shortcut clear', () => field.press('Control+Alt+n'), async () => assert.equal(await field.inputValue(), 'sample'));
    await pressFormat(field, 'Control+Shift+Period', 'sample', '> sample');
    await field.fill('sample');
    await select(field, 'sample', 'backward');
    await timed('shortcut link', () => field.press('Control+k'), () => page.getByRole('dialog', { name: 'Add link' }).waitFor());
    const link = page.getByRole('textbox', { name: 'Link URL' });
    const apply = page.getByRole('button', { name: 'Apply link' });
    await link.fill('javascript:fixture()');
    assert(await apply.isDisabled());
    await link.fill('https://example.invalid/formatting');
    await timed('apply link', () => apply.click(), async () => {
      assert.equal(await field.inputValue(), '[sample](<https://example.invalid/formatting>)');
      await selection(field, 'sample', 'backward');
    });

    await field.fill(tag + ' • Boldword Italicword Underword Strikeword Codeword ' + secret);
    await pressFormat(field, 'Control+b', 'Boldword', '**Boldword**');
    await pressFormat(field, 'Control+i', 'Italicword', '*Italicword*');
    await pressFormat(field, 'Control+u', 'Underword', '^^Underword^^');
    await pressFormat(field, 'Control+Shift+x', 'Strikeword', '~~Strikeword~~');
    await pressFormat(field, 'Control+Alt+m', 'Codeword', '`Codeword`');
    await pressFormat(field, 'Control+Alt+p', secret, '||' + secret + '||');

    const sendGate = await holdFirst('**/api/dm/send');
    try {
      await timed('optimistic send', send, () => preview().getByText(hidden, { exact: false }).first().waitFor());
      await sendGate.waitForFirst();
      await assertMask(preview(), secret);
      const sentText = sendGate.posts[0].body;
      assert(sentText.includes('||' + secret + '||'));
      const newer = await openCompose();
      await newer.fill('New unsent draft');
      await pressFormat(newer, 'Control+i', 'unsent', '*unsent*');
      if (zoom) await page.locator('#dialog-cancel').click();
      sendGate.release();
      const retry = preview().getByRole('button', { name: 'Retry', exact: true });
      await retry.waitFor();
      await retry.click();
      const stored = preview().locator(zoom ? 'button.mc-bubble' : '.body-markdown');
      await stored.waitFor();
      messageID = await preview().getAttribute('id');
      assert.deepEqual(sendGate.posts[1], sendGate.posts[0]);
      const draft = await openCompose();
      assert.equal(await draft.inputValue(), 'New *unsent* draft');
      if (zoom) await page.locator('#dialog-cancel').click();
    } finally { sendGate.release(); await sendGate.stop(); }

    if (zoom) await assertMask(preview(), secret);
    const message = await openMessage();
    await assertMask(message, secret);
    for (const [tagName, text] of [['strong','Boldword'], ['em','Italicword'], ['u','Underword'], ['del','Strikeword'], ['code','Codeword']]) {
      assert.equal(await message.locator('.body-markdown ' + tagName).textContent(), text);
    }
    await reveal(message, secret, node => node.press('Enter'), 'keyboard');
    await message.getByRole('button', { name: secret, exact: true }).press('Space');
    await assertMask(message, secret);

    const editor = await edit(message);
    await editor.fill(tag + ' revised ' + revised);
    await pressFormat(editor, 'Control+Shift+p', revised, '||' + revised + '||');
    const editGate = await holdFirst('**/api/message/edit');
    try {
      const save = message.getByRole('button', { name: 'Save', exact: true });
      await timed('held edit feedback', () => save.click(), async () => assert(await save.isDisabled()));
      await editGate.waitForFirst();
      await editor.focus();
      await select(editor, revised, 'backward');
      // An unrelated incoming view update redraws the message while Save waits.
      if (zoom) {
        const get = page.waitForResponse(response => /\/api\/dm\?id=/.test(response.url()));
        await page.evaluate(conv => window.agentnet.api('/api/dm/send', {conv, body: 'Unrelated update'}), conv);
        await get;
      } else {
        await page.locator('.topics-bar').getByRole('button', { name: /^Main(?: flow)?$/, pressed: true }).click();
        await editor.focus(); // the user had explicitly moved focus to the topic button
      }
      await selection(editor, revised, 'backward');
      editGate.release();
      await message.getByRole('alert').filter({hasText: /unavailable|503/i}).waitFor();
      assert.equal(await editor.inputValue(), tag + ' revised ||' + revised + '||');
      assert(await save.isEnabled());
      await save.click();
      await message.locator('.edited').waitFor();
      assert.deepEqual(editGate.posts[1], editGate.posts[0]);
    } finally { editGate.release(); await editGate.stop(); }
    await assertMask(message, revised);
    assert(!(await message.textContent()).includes(secret), 'Original text in Details stays masked');
    await reveal(message, revised, node => node.click(), 'edited');

    await message.getByRole('button', { name: 'Reply', exact: true }).first().click();
    await assertMask(quote(), revised);
    const reply = compose();
    await reply.waitFor();
    assert.equal(await reply.inputValue(), 'New *unsent* draft', 'Draft survives the edit and reply');
    await reply.fill('Masked quote verification ' + id);
    await send();
    await list().getByText(/Reply to: .*\[Hidden text\]/).last().waitFor();
    assert(!(await list().getByText(/Reply to: .*\[Hidden text\]/).last().textContent()).includes(revised));
    const searchWord = 'Findable preview ' + id;
    const searchSecret = 'search private galaxy ' + id;
    const searchDraft = await openCompose();
    await searchDraft.fill(searchWord + ' ||' + searchSecret + '||');
    await send();
    await list().locator(zoom ? 'button.mc-bubble' : '.body-markdown').filter({ hasText: searchWord }).waitFor();
    await page.locator('#nav-chats').click();
    if (!zoom && await page.locator('.side[data-hidden]').count()) await page.locator('#nav-chats').click();
    await settled();
    await search().fill(searchWord);
    const results = page.locator(zoom ? '.zoom-results .result' : '#conv-list .result');
    await results.first().waitFor();
    assert(!(await results.first().textContent()).includes(searchSecret));
    await search().fill(searchSecret);
    assert.equal(await results.count(), 0);
  } finally { await context.close(); }
}

async function touch() {
  const context = await open(true);
  try {
    const field = await openCompose();
    await field.fill('Select this range');
    const trigger = field.locator('..').getByRole('button', { name: 'Formatting', exact: true });
    assert(!(await trigger.isVisible()));
    await timed('touch selection control', () => select(field, 'this range'), () => trigger.waitFor());
    assert((await trigger.boundingBox()).height >= 44);
    await timed('touch formatting menu', () => trigger.tap(), () => item('Underline').waitFor());
    await screenshot('touch-compose');
    await timed('touch format action', () => item('Underline').tap(), async () => {
      assert.equal(await field.inputValue(), 'Select ^^this range^^');
      await selection(field, 'this range');
    });
    await field.fill('');
    if (zoom) await page.locator('#dialog-cancel').tap();
    await preview().waitFor();
    const message = await openMessage();
    const editor = await edit(message, true);
    assert(!(await message.locator('.edit-box').textContent()).includes('false'));
    await select(editor, revised);
    const editTrigger = editor.locator('..').getByRole('button', { name: 'Formatting', exact: true });
    await editTrigger.waitFor();
    const a = await editor.boundingBox(), b = await editTrigger.boundingBox();
    assert(b.y >= a.y + a.height && b.height >= 44, 'Edit Formatting is below the field with a 44px target');
    await timed('touch edit menu', () => editTrigger.tap(), () => item('Bold').waitFor());
    const oldRow = await message.elementHandle();
    try {
      await page.evaluate(conv => window.agentnet.api('/api/dm/send', { conv, body: 'Unrelated update during touch formatting' }), conv);
      await page.waitForFunction(row => !row.isConnected, oldRow);
    } finally { await oldRow.dispose(); }
    assert(await item('Bold').isVisible(), 'Formatting stays open across a same-message refresh');
    assert(await item('Bold').evaluate(node => node.getRootNode().activeElement === node), 'Refresh keeps focus on the formatting choice');
    await screenshot('touch-edit');
    await timed('touch edit action', () => item('Bold').tap(), async () => {
      assert((await editor.inputValue()).includes('||**' + revised + '**||'));
      await selection(editor, revised);
    });
    await message.getByRole('button', { name: 'Cancel', exact: true }).tap();
    await assertMask(message, revised);
    const spoiler = message.getByRole('button', { name: hidden, exact: true });
    const target = await page.evaluate(({ zoom, messageID }) => {
      const root = document.querySelector('#skin').shadowRoot;
      const message = zoom ? root.querySelector('.zoom-layer:last-child .zoom-message') : root.getElementById(messageID);
      const node = message?.querySelector('.message-spoiler[aria-pressed="false"]');
      const box = node?.getBoundingClientRect();
      return box && { width: box.width, height: box.height };
    }, { zoom, messageID });
    assert(target && target.width >= 44 && target.height >= 44, 'Touch spoiler has a 44px target');
    await timed('touch reveal', () => spoiler.tap(), () => message.getByRole('button', { name: revised, exact: true }).waitFor());
  } finally { await context.close(); }
}

(async () => {
  browser = await chromium.launch({ headless: true, executablePath: process.env.AGENTNET_CHROMIUM || undefined });
  await desktop();
  await touch();
  assert.deepEqual(errors, []);
  const max = Math.max(...Object.values(samples));
  fs.writeFileSync(path.join(evidence, id + '-formatting.json'), JSON.stringify({ id, family, chromium: browser.version(),
    samples, max, bound: localLimit, touch: 'Chromium touch emulation with native textarea selection range and real taps' }, null, 2));
  console.log('PASS ' + id + ' standalone formatting: ' + Object.keys(samples).length + ' measured actions, maximum ' + max + ' ms (bound ' + localLimit + ' ms)');
})().catch(async error => {
  await screenshot('FAIL').catch(() => {});
  console.error(error.stack, '\nMeasured actions:', samples, '\nPage errors:', errors);
  process.exitCode = 1;
}).finally(async () => { await browser?.close(); });
