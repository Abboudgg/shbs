// قاعدة بيانات بسيطة: ملف JSON
const fs = require('fs');
const path = require('path');
const DIR = path.join(__dirname, '..', 'data');
const FILE = path.join(DIR, 'db.json');
fs.mkdirSync(DIR, { recursive: true });
let data = { guilds: {} };
try { data = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
let t = null;
const flush = () => { try { fs.writeFileSync(FILE, JSON.stringify(data)); } catch (e) { console.error('db', e.message); } };
const save = () => { clearTimeout(t); t = setTimeout(flush, 400); };
function guild(id) {
  const g = (data.guilds[id] ??= {});
  g.channel ??= null; g.staffRole ??= null; g.n ??= 0; g.sugs ??= {};
  return g;
}
process.on('exit', flush);
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => { flush(); process.exit(0); });
module.exports = { guild, save };
