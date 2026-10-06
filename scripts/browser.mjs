import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
// Resolve while the invoking HOME still owns Playwright's installed browser cache.
export function browserEnvironment(env=process.env){
 const playwright=env.AGENTNET_PLAYWRIGHT||require.resolve('playwright');
 const executable=path.resolve(env.AGENTNET_CHROMIUM||require(playwright).chromium.executablePath());
 return {AGENTNET_PLAYWRIGHT:playwright,AGENTNET_CHROMIUM:executable};
}
