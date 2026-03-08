const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');

const cmd = new Command('names')
  .argument('[address]', 'Wallet address (defaults to configured wallet)')
  .description('List names owned by an address')
  .action(async (address) => {
    try {
      const addr = address || conf.get('wallet');
      if (!addr) {
        out.error('No address provided. Pass an address or run: hazza config set wallet <address>');
        process.exit(1);
      }

      const result = await api.names(addr);
      const nameList = result.names || result || [];

      if (out.isJsonMode()) return out.json(nameList);

      if (nameList.length === 0) {
        out.warn(`No names found for ${addr}`);
        return;
      }

      out.heading(`Names for ${addr}`);
      out.table(
        ['Name', 'Token ID', 'Status'],
        nameList.map(n => [
          n.name,
          n.tokenId || '—',
          (n.status || 'active').charAt(0).toUpperCase() + (n.status || 'active').slice(1),
        ]),
      );
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
