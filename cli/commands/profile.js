const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const chalk = require('chalk');

const cmd = new Command('profile')
  .argument('<name>', 'Name to look up')
  .description('Show a full HAZZA profile')
  .action(async (name) => {
    try {
      const result = await api.profile(name);

      if (out.isJsonMode()) return out.json(result);

      out.heading(name);
      out.item(result, [
        ['Owner', 'owner'],
        ['Token ID', 'tokenId'],
        ['Registered', 'registeredAt', v => v ? new Date(v * 1000).toLocaleDateString() : '—'],
        ['Status', d => chalk.green('Permanent')],
        ['Profile URL', d => `https://${name}.hazza.name`],
      ]);

      // Text records
      const records = result.textRecords || result.texts || {};
      const keys = Object.keys(records).filter(k => records[k]);
      if (keys.length > 0) {
        out.heading('Text Records');
        out.table(
          ['Key', 'Value'],
          keys.map(k => [k, records[k]]),
        );
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
