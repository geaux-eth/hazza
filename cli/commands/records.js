const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('records')
  .description('Get or set text records for a name');

cmd
  .command('get <name> <key>')
  .description('Get a text record')
  .action(async (name, key) => {
    try {
      const result = await api.getText(name, key);
      if (out.isJsonMode()) return out.json(result);
      const value = result.value ?? result.text ?? result;
      if (value) {
        console.log(value);
      } else {
        out.warn(`No record found for key "${key}"`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd
  .command('set <name> <key> <value>')
  .description('Set a text record (requires cast)')
  .action(async (name, key, value) => {
    try {
      payment.requireCast();
      const registryAddress = conf.get('registryAddress');
      const rpcUrl = conf.get('rpcUrl');

      out.info(`Setting ${key} = "${value}" for ${name}...`);
      const txHash = payment.contractSend(
        registryAddress,
        'setText(string,string,string)',
        [name, key, value],
        rpcUrl,
      );

      out.success(`Record set!`);
      out.info(`Tx: ${txHash}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

cmd
  .command('list <name>')
  .description('List all text records for a name')
  .action(async (name) => {
    try {
      const result = await api.profile(name);
      const records = result.textRecords || result.texts || {};
      const keys = Object.keys(records).filter(k => records[k]);

      if (out.isJsonMode()) return out.json(records);

      if (keys.length === 0) {
        out.warn(`No text records for "${name}"`);
        return;
      }

      out.heading(`Text Records — ${name}`);
      out.table(['Key', 'Value'], keys.map(k => [k, records[k]]));
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
