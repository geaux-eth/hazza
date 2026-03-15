const { Command } = require('commander');
const api = require('../lib/api');
const out = require('../lib/output');

const cmd = new Command('contact')
  .argument('<name>', 'Name to look up contact info for')
  .description('Resolve contact info for a name (follows delegate chain)')
  .action(async (name) => {
    try {
      const result = await api.contact(name);

      if (out.isJsonMode()) return out.json(result);

      out.heading(`Contact — ${result.name}`);

      if (result.isDelegated) {
        out.info(`Mode: ${result.mode}`);
        out.info(`Delegate: ${result.contactName || result.delegateXmtp || '(not set)'}`);
      }

      if (result.contactAddress) {
        out.success(`XMTP: ${result.contactAddress}`);
        if (result.xmtpUrl) out.info(`Chat: ${result.xmtpUrl}`);
      } else {
        out.warn('No XMTP address found — this name has no messaging endpoint.');
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
