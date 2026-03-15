const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const api = require('../lib/api');
const out = require('../lib/output');
const conf = require('../lib/config');
const payment = require('../lib/payment');

const cmd = new Command('site')
  .description('Manage your hazza site');

// hazza site upload <name> <file>
cmd
  .command('upload <name> <file>')
  .description('Upload an HTML file as your hazza site via Net Protocol')
  .action(async (name, file) => {
    try {
      payment.requireCast();

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

      // Read file
      const filePath = path.resolve(file);
      if (!fs.existsSync(filePath)) {
        out.error(`File not found: ${filePath}`);
        process.exit(1);
      }
      const content = fs.readFileSync(filePath, 'utf8');
      const sizeKB = (Buffer.byteLength(content) / 1024).toFixed(1);
      out.info(`Read ${filePath} (${sizeKB} KB)`);

      // Storage key for this name's site
      const storageKey = `hazza-site-${name}`;

      // Check if netp CLI is available
      let hasNetp = false;
      try {
        const { execFileSync: efs } = require('child_process');
        efs('netp', ['--version'], { stdio: 'pipe' });
        hasNetp = true;
      } catch {
        // netp not installed
      }

      if (hasNetp) {
        // Upload via netp CLI
        out.info(`Uploading to Net Protocol as "${storageKey}"...`);
        try {
          // Write content to temp file for upload
          const tmpFile = path.join(require('os').tmpdir(), `hazza-site-${name}.html`);
          fs.writeFileSync(tmpFile, content, { mode: 0o600 });

          const rpc = conf.get('rpcUrl');
          const { execFileSync } = require('child_process');
          const result = execFileSync('netp', [
            'storage', 'upload',
            '--file', tmpFile,
            '--text', `hazza site for ${name}`,
            '--key', storageKey,
            '--address', wallet,
            '--rpc-url', rpc,
          ], { encoding: 'utf8', timeout: 120000 });
          out.info(result.trim());

          // Clean up temp file
          fs.unlinkSync(tmpFile);

          out.success(`Uploaded to Net Protocol: ${storageKey}`);
        } catch (e) {
          out.error(`Net Protocol upload failed: ${e.message}`);
          out.info('');
          out.info('Alternative: host your HTML anywhere and use:');
          out.info(`  hazza site set ${name} https://your-url-here`);
          process.exit(1);
        }
      } else {
        out.warn('netp CLI not installed — cannot upload directly to Net Protocol.');
        out.info('');
        out.info('Options:');
        out.info('  1. Install netp: npm install -g @net-protocol/cli');
        out.info('  2. Upload your HTML file to any HTTPS host, then run:');
        out.info(`     hazza site set ${name} https://your-url-here`);
        out.info('  3. Use IPFS, GitHub Pages, or any static host');
        process.exit(1);
      }

      // Now set the site.key text record
      out.info(`Setting site.key text record to "${storageKey}"...`);
      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'setText(string,string,string)',
        [name, 'site.key', storageKey],
      );

      out.success(`Site deployed for "${name}"!`);
      out.info(`Tx: ${txHash}`);
      out.info(`Live at: https://${name}.hazza.name`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// hazza site set <name> <url-or-key>
cmd
  .command('set <name> <urlOrKey>')
  .description('Set your site content URL or Net Protocol storage key')
  .action(async (name, urlOrKey) => {
    try {
      payment.requireCast();

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

      out.info(`Setting site.key for "${name}" to: ${urlOrKey}`);

      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'setText(string,string,string)',
        [name, 'site.key', urlOrKey],
      );

      out.success(`site.key set for "${name}"`);
      out.info(`Tx: ${txHash}`);
      out.info(`Your site will be live at: https://${name}.hazza.name`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// hazza site remove <name>
cmd
  .command('remove <name>')
  .description('Remove your custom site (reverts to profile page)')
  .action(async (name) => {
    try {
      payment.requireCast();

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

      const registry = conf.get('registryAddress');
      const txHash = payment.contractSend(
        registry,
        'setText(string,string,string)',
        [name, 'site.key', ''],
      );

      out.success(`Site removed for "${name}" — profile page will show instead`);
      out.info(`Tx: ${txHash}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

// hazza site info <name>
cmd
  .command('info <name>')
  .description('Check if a name has a custom site configured')
  .action(async (name) => {
    try {
      const result = await api.getText(name, 'site.key');
      const value = result?.value || result?.record || '';
      if (value) {
        out.success(`"${name}" has a custom site`);
        out.info(`site.key: ${value}`);
        out.info(`Live at: https://${name}.hazza.name`);
      } else {
        out.info(`"${name}" has no custom site — showing default profile page`);
      }
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
