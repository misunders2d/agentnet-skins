import test from "node:test";
import assert from "node:assert/strict";

// AgentNet v0.11.12: WPS Office cells in the desktop app (WebKitGTK) reach the
// paste event with no text and no file; the native clipboard text wins over
// its picture, a screenshot (no text) still attaches, and browser text keeps
// the earlier order without reading native text.
for (const skin of ["classic", "holonet", "zoom"]) {
  test(`${skin} pastes native clipboard text before reading a picture`, async () => {
    const { pastePictures } = await import(`../skins/${skin}/src/pictures.mjs`);
    const ev = (t = "") => ({ clipboardData: { files: [], getData: () => t }, prevented: false, preventDefault() { this.prevented = true; } });
    const got = [], att = [];
    let images = 0, texts = 0;
    const opts = { insertText: s => got.push(s), clipboardImage: async () => { images++; return { name: "p.png" }; }, clipboardText: async () => { texts++; return "SKU-1\r\nSKU-2\r\n"; } };
    const e = ev();
    const pending = pastePictures(e, f => att.push(...f), opts);
    assert.equal(e.prevented, true);
    await pending;
    assert.deepEqual(got, ["SKU-1\nSKU-2"]);
    assert.equal(images, 0);
    opts.clipboardText = async () => null;
    await pastePictures(ev(), f => att.push(...f), opts);
    assert.equal(att.length, 1, "a screenshot still attaches");
    texts = 0;
    opts.clipboardText = async () => { texts++; return "unused"; };
    await pastePictures(ev("https://example.com/cat.png"), f => att.push(...f), opts);
    assert.equal(texts, 0, "browser text present: native text unread");
    assert.equal(att.length, 2, "a browser image copy still attaches");
    const errs = [];
    opts.error = s => errs.push(s);
    opts.clipboardText = async () => { throw Error("too long"); };
    images = 0;
    await pastePictures(ev(), f => att.push(...f), opts);
    assert.equal(images, 0, "a failed text read attaches no picture");
    assert.equal(errs.length, 1);
    opts.clipboardText = async () => "cells\n\n";
    await pastePictures(ev(), f => att.push(...f), { ...opts, files: false });
    assert.equal(got.at(-1), "cells\n", "no-file box recovers text; one row end dropped");
    const fe = { clipboardData: { files: [{ name: "x" }], getData: () => "" }, prevented: false, preventDefault() { this.prevented = true; } };
    await pastePictures(fe, f => att.push(...f), { ...opts, files: false });
    assert.equal(fe.prevented, false);
    assert.equal(att.length, 2);
  });
}
