const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const { formatUSDC } = require('../lib/payment');

const cmd = new Command('search')
  .argument('<name>', 'Name to search for')
  .description('Check name availability and pricing')
  .action(async (name) => {
    try {
      const result = await api.checkAvailable(name);

      if (out.isJsonMode()) {
        // Enrich with quote if available
        if (result.available) {
          const wallet = conf.get('wallet');
          const quoteData = await api.quote(name, wallet).catch(() => null);
          return out.json({ ...result, quote: quoteData });
        }
        return out.json(result);
      }

      out.heading(name);

      if (result.available) {
        out.success('Available!');
        // Get price quote
        const wallet = conf.get('wallet');
        const quoteData = await api.quote(name, wallet).catch(() => null);
        if (quoteData) {
          out.info(`Price: ${formatUSDC(quoteData.totalCost || quoteData.price || 0)} USDC (pay once, available forever)`);
        }
        // Check free claim
        if (wallet) {
          const fc = await api.freeClaim(wallet).catch(() => null);
          if (fc && fc.eligible) {
            out.success('You are eligible for a FREE name (Unlimited Pass + NL member)!');
          }
        }
        out.info(`Register: hazza register ${name}`);
      } else {
        out.warn('Not available');
        if (result.owner) out.info(`Owner: ${result.owner}`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
