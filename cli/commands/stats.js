const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');

const cmd = new Command('stats')
  .description('Show HAZZA registry statistics')
  .action(async () => {
    try {
      const result = await api.stats();

      if (out.isJsonMode()) return out.json(result);

      out.heading('HAZZA Registry Stats');
      out.item(result, [
        ['Total Registered', 'totalRegistered'],
        ['Contract', 'contract'],
        ['Chain', d => d.chain === '8453' ? 'Base Mainnet' : `Unknown (chain ${d.chain})`],
        ['Website', d => 'https://hazza.name'],
      ]);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
