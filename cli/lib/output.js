const chalk = require('chalk');
const Table = require('cli-table3');

let jsonMode = false;

function setJsonMode(val) { jsonMode = !!val; }
function isJsonMode() { return jsonMode; }

function json(data) { console.log(JSON.stringify(data, null, 2)); }

function success(msg) {
  if (jsonMode) return json({ success: true, message: msg });
  console.log(chalk.green('✓'), msg);
}

function error(msg) {
  if (jsonMode) console.error(JSON.stringify({ error: msg }));
  else console.error(chalk.red('✗'), msg);
}

function warn(msg) {
  if (!jsonMode) console.log(chalk.yellow('!'), msg);
}

function info(msg) {
  if (!jsonMode) console.log(chalk.dim(msg));
}

function table(headers, rows, opts = {}) {
  if (jsonMode) {
    return json(rows.map(r => headers.reduce((o, h, j) => ({ ...o, [h]: r[j] }), {})));
  }
  const t = new Table({
    head: headers.map(h => chalk.cyan(h)),
    style: { head: [], border: [] },
    wordWrap: true,
    ...opts,
  });
  rows.forEach(r => t.push(r));
  console.log(t.toString());
}

function item(data, fields) {
  if (jsonMode) return json(data);
  const t = new Table({ style: { head: [], border: [] } });
  fields.forEach(([label, key, transform]) => {
    const val = typeof key === 'function' ? key(data) : data[key];
    const display = transform ? transform(val) : (val ?? chalk.dim('—'));
    t.push({ [chalk.cyan(label)]: String(display) });
  });
  console.log(t.toString());
}

function heading(text) {
  if (!jsonMode) console.log('\n' + chalk.bold.white(text));
}

module.exports = { setJsonMode, isJsonMode, json, success, error, warn, info, table, item, heading };
