/* node check.js — sanity checks on data.js before a deploy:
   no pork in any human recipe, every recipe fully tagged, unique ids. */
const fs = require('fs');
eval(fs.readFileSync(__dirname + '/data.js', 'utf8').replace(/^const /gm, 'var '));
const PORK = /\b(pork|bacon|ham|lard|prosciutto|pancetta|guanciale|chorizo|salami|pepperoni|gelatin|wine|mirin)\b/i;
const errs = [], ids = new Set();
for (const r of RECIPES) {
  if (ids.has(r.id)) errs.push('duplicate id ' + r.id); ids.add(r.id);
  const text = JSON.stringify([r.title, r.ingredients, r.steps]);
  if (r.kind === 'human' && PORK.test(text)) errs.push(`${r.id}: mentions "${text.match(PORK)[0]}"`);
  if (!LEVELS.includes(r.level)) errs.push(r.id + ': bad level');
  if (r.kind === 'human' && !COURSES.includes(r.course)) errs.push(r.id + ': bad course');
  if (r.kind === 'dog' && !DOG_COURSES.includes(r.course)) errs.push(r.id + ': bad dog course');
  if (r.kind === 'human' && !CUISINE_INFO.some(c => c.id === r.cuisine)) errs.push(r.id + ': bad cuisine');
}
const h = RECIPES.filter(r => r.kind === 'human'), count = k => Object.entries(h.reduce((a, r) => (a[r[k]] = (a[r[k]] || 0) + 1, a), {}));
console.log(`${h.length} human, ${RECIPES.length - h.length} dog`);
console.log('courses', count('course').join(' ')); console.log('levels', count('level').join(' ')); console.log('cuisines', count('cuisine').join(' '));
if (errs.length) { console.error(errs.join('\n')); process.exit(1); } else console.log('OK — pork-free');
