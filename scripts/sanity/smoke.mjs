// sanity:smoke — proves the editor token and the dataset's visibility (T15).
//
//   npm run sanity:smoke
//
// 1. With the token: create the draft drafts.smoke-test, read it back, delete it, and
//    confirm it is gone.
// 2. Visibility: publish a throwaway document of type smokeTest, read it WITHOUT a token
//    (so the dataset must be public, as the Free plan and the static build require),
//    then delete it.
// Exits 1 on any failure, 3 on a 403 (see SANITY.md §403 rule). The token is never printed.
import { publicClient, writeClient, isForbidden, FORBIDDEN_HELP } from './client.mjs';

const w = writeClient();
const anon = publicClient();
const stamp = new Date().toISOString();
const fail = (msg) => { console.error(`✗ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✓ ${msg}`);

try {
  const draftId = 'drafts.smoke-test';
  await w.createOrReplace({ _id: draftId, _type: 'post', title: `Smoke test ${stamp}`, model: 'smoke' });
  const back = await w.getDocument(draftId);
  back?.title === `Smoke test ${stamp}` ? ok('draft created and read back with the token') : fail('draft not read back');
  const hidden = await anon.fetch('*[_id == $id][0]', { id: draftId });
  hidden == null ? ok('draft is invisible without a token') : fail('draft visible anonymously');
  await w.delete(draftId);
  (await w.getDocument(draftId)) == null ? ok('draft deleted') : fail('draft still exists after delete');

  const pubId = 'smoke-test-public';
  await w.createOrReplace({ _id: pubId, _type: 'smokeTest', stamp });
  let seen = null;
  for (let i = 0; i < 10 && seen?.stamp !== stamp; i++) {
    seen = await anon.fetch('*[_id == $id][0]{stamp}', { id: pubId });
    if (seen?.stamp !== stamp) await new Promise((r) => setTimeout(r, 500));
  }
  seen?.stamp === stamp ? ok('published document readable without a token (dataset is public)') : fail('published document not readable anonymously: is the dataset private?');
  await w.delete(pubId);
  (await w.getDocument(pubId)) == null ? ok('public test document deleted') : fail('public test document still exists');
} catch (e) {
  // Client errors carry the status and message, never the token.
  fail(`${e.statusCode ?? ''} ${e.message}`.trim());
  if (isForbidden(e)) { console.error(FORBIDDEN_HELP); process.exitCode = 3; }
}
