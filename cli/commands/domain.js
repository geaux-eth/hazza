const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('domain')
  .description('Manage custom domain mapping for your hazza name');

// hazza domain set <name> <domain>
cmd
  .command('set <name> <domain>')
  .description('Map a custom domain to your hazza name')
  .action(async (name, domain) => {
    try {
      const wallet = conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }

      // Verify ownership
      const resolved = await api.resolve(name);
      if (!resolved || !resolved.owner) {
        out.error(`"${name}" is not registered`);
        process.exit(1);
      }
      if (resolved.owner.toLowerCase() !== wallet.toLowerCase()) {
        out.error(`You don't own "${name}". Owner: ${resolved.owner}`);
        process.exit(1);
      }

      // Clean domain input
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

      out.info(`Mapping ${cleanDomain} → ${name}.hazza.name`);

      // Call setCustomDomain on the registry contract
      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'setCustomDomain(string,string)',
        [name, cleanDomain],
      );

      out.success(`Custom domain set: ${cleanDomain} → ${name}`);
      out.info(`Tx: ${txHash}`);
      out.info('');
      out.info('Next steps:');
      out.info(`  1. Add a CNAME record for ${cleanDomain} pointing to hazza.name`);
      out.info('  2. If using root domain (@), use CNAME flattening (Cloudflare) or an ALIAS record');
      out.info(`  3. Visit https://${cleanDomain} to verify`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// hazza domain remove <name> <domain>
cmd
  .command('remove <name> <domain>')
  .description('Remove a custom domain mapping from your hazza name')
  .action(async (name, domain) => {
    try {
      const wallet = conf.get('wallet');
      if (!wallet) {
        out.error('No wallet configured. Run: hazza config set wallet <address>');
        process.exit(1);
      }

      const resolved = await api.resolve(name);
      if (!resolved || !resolved.owner) {
        out.error(`"${name}" is not registered`);
        process.exit(1);
      }
      if (resolved.owner.toLowerCase() !== wallet.toLowerCase()) {
        out.error(`You don't own "${name}". Owner: ${resolved.owner}`);
        process.exit(1);
      }

      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'removeCustomDomain(string,string)',
        [name, cleanDomain],
      );

      out.success(`Custom domain "${cleanDomain}" removed for "${name}"`);
      out.info(`Tx: ${txHash}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// hazza domain verify <domain>
cmd
  .command('verify <domain>')
  .description('Check if a domain\'s DNS is correctly pointed to hazza.name')
  .action(async (domain) => {
    try {
      const cleanDomain = domain.toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '');

      out.info(`Checking DNS for ${cleanDomain}...`);

      // Use dig/nslookup via cast if available, otherwise just try fetching
      if (payment.castAvailable()) {
        try {
          const result = payment.cast(['resolve-name', cleanDomain]);
          if (result) {
            out.success(`${cleanDomain} resolves to: ${result}`);
          }
        } catch {
          // cast resolve-name might not work for non-ENS, that's ok
        }
      }

      // Try hitting the domain through our worker to see if it resolves
      out.info(`Testing https://${cleanDomain}...`);
      try {
        const res = await fetch(`https://${cleanDomain}`, {
          method: 'HEAD',
          redirect: 'manual',
          signal: AbortSignal.timeout(10000),
        });
        if (res.status === 200) {
          out.success(`${cleanDomain} is live and serving content`);
        } else if (res.status === 404) {
          out.warn(`${cleanDomain} reached hazza but no name is mapped. Run: hazza domain set <name> ${cleanDomain}`);
        } else {
          out.warn(`${cleanDomain} returned status ${res.status}`);
        }
      } catch (e) {
        out.error(`Could not reach ${cleanDomain}. Make sure DNS is pointed to hazza.name (CNAME record).`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
