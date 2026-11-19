const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync(__dirname + '/index.html', 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const play = 'https://play.google.com/store/apps/details?id=pl.dramich.celownik';
const appStore = 'https://apps.apple.com/app/id6825866068';
const beta = 'itms-beta://testflight.apple.com/join/B2u2NmBe';
function render(androidMode, iosMode, userAgent, manual = false, language = 'pl-PL') {
  const elements = new Map();
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    elements.set(match[1], {hidden: /\shidden(?:\s|>)/.test(match[0]), textContent: '', classList: {add() {}}, addEventListener() {}});
  }
  const parent = {classList: {add() {}}};
  for (const element of elements.values()) element.parentElement = parent;
  const redirects = [];
  const context = vm.createContext({URL, URLSearchParams, navigator: {userAgent, language, platform: userAgent === 'touch iPad' ? 'MacIntel' : '', maxTouchPoints: userAgent === 'touch iPad' ? 5 : 0}, location: {search: manual ? '?wybor=1' : '?start=1', replace(url) {redirects.push(url);}}, localStorage: {getItem() {return null;}, setItem() {}, removeItem() {}}, document: {documentElement: {}, getElementById(id) {assert.ok(elements.has(id), id);return elements.get(id);}}});
  let config = scripts[0].replace(/(android:\s*\{\s*mode:) '(?:testing|public)'/, `$1 '${androidMode}'`).replace(/(ios:\s*\{\s*mode:) '(?:testing|public)'/, `$1 '${iosMode}'`);
  vm.runInContext(config, context);
  vm.runInContext(scripts[1], context);
  return {elements, redirects, context};
}
let cases = 0;
for (const language of ['pl-PL', 'en-US']) {
  for (const android of ['testing', 'public']) {
    for (const ios of ['testing', 'public']) {
      for (const ua of ['Android', 'iPhone', 'touch iPad', 'desktop']) {
        for (const manual of [false, true]) {
          const {elements: e, redirects} = render(android, ios, ua, manual, language);
          assert.equal(e.get('android-link').href, play);
          assert.equal(e.get('ios-heading').textContent, ios === 'testing' ? 'TestFlight' : 'App Store');
          assert.equal(e.has('android-enrollment'), false);
          if (ua === 'Android' && !manual) assert.deepEqual(redirects, [play]);
          else if (['iPhone', 'touch iPad'].includes(ua) && !manual) assert.deepEqual(redirects, [ios === 'testing' ? beta : appStore]);
          else assert.deepEqual(redirects, []);
          assert.equal(e.get('ios-link').href, ios === 'public' ? appStore : ['iPhone', 'touch iPad'].includes(ua) && !manual ? beta : 'https://testflight.apple.com/join/B2u2NmBe');
          if (manual) assert.equal(e.get('ios-choice').hidden, false);
          if (ios === 'public' || ua === 'desktop' || manual) assert.equal(e.get('ios-install-link').hidden, true);
          cases++;
        }
      }
    }
  }
}
assert.ok(!html.includes('groups.google.com'));
assert.ok(!html.includes('play.google.com/apps/testing/'));
assert.match(scripts[0], /ios:\s*\{\s*mode:\s*'public'/);
assert.match(html, /id="ios-link" href="https:\/\/apps\.apple\.com\/app\/id6825866068"/);
const {context} = render('testing', 'testing', 'desktop');
assert.equal(vm.runInContext("downloadUrl('ios', {mode:'public',ios:{public:'javascript:alert(1)'}})",context),null);
assert.equal(vm.runInContext("downloadUrl('android', {mode:'public',android:{public:'https://example.com/app'}})",context),null);
console.log(`PASS: ${cases} routing/UI combinations, including mixed Google Play + TestFlight, iPad, manual selection and PL/EN; unsafe URLs rejected.`);
