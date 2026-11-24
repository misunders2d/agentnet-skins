import assert from 'node:assert/strict';
import { test } from 'node:test';

const el = (tag, attrs, ...children) => ({ tag, children });
for (const skin of ['classic', 'holonet', 'zoom']) {
  test(skin + ' preserves single-line Markdown blocks', async () => {
    const { messageMarkdown } = await import('../skins/' + skin + '/src/message-markdown.mjs');
    const render = text => messageMarkdown(text, { el, mention: () => [] });
    const [list] = render('1. Ordered item');
    assert.equal(list.tag, 'ol');
    const [code] = render('    Indented code');
    assert.equal(code.tag, 'pre');
    assert.equal(code.children[0].tag, 'code');
    assert.deepEqual(render('Plain message'), [el('p', {}, 'Plain message')]);
  });
}
