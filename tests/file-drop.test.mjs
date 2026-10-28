import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {test} from 'node:test';
import {root,upstream} from '../scripts/lib.mjs';

const require=createRequire(import.meta.url);
test('all shipped composers keep browser file drops and native file drops in their exact draft until Send', {skip:!process.env.AGENTNET_CHROMIUM}, () => {
 const result=spawnSync(process.execPath,[path.join(upstream(),'internal/ui/testdata/file_drop_rendered.cjs')],{
  encoding:'utf8',timeout:120000,
  env:{...process.env,AGENTNET_DROP_SKINS:path.join(root,'dist'),AGENTNET_PLAYWRIGHT:process.env.AGENTNET_PLAYWRIGHT||require.resolve('playwright')}
 });
 assert.equal(result.status,0,result.error?.message||result.stdout+result.stderr);
 for(const skin of ['comic','classic','zoom','holonet'])for(const width of [1280,390])for(const kind of ['FILE DROP PASS ','NATIVE GRANT DROP PASS '])assert(result.stdout.includes(kind+skin+' '+width),result.stdout);
});
