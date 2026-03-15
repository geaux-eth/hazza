const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const api = require('../lib/api');
const out = require('../lib/output');

const cmd = new Command('export')
  .argument('<name>', 'Name to export')
  .option('-o, --output <file>', 'Output file path')
  .option('-e, --encrypt', 'Encrypt the backup with a password')
  .description('Export all records for a hazza name as a JSON backup')
  .action(async (name, opts) => {
    try {
      out.info(`Exporting records for "${name}"...`);

      const result = await api.get(`/api/export/${name}`);
      if (result.error) {
        out.error(result.error);
        process.exit(1);
      }

      let outputData = JSON.stringify(result, null, 2);
      let filename = opts.output || `${name}.hazza.json`;

      if (opts.encrypt) {
        // Prompt for password
        const readline = require('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const password = await new Promise((resolve) => {
          process.stdout.write('Enter encryption password: ');
          // Hide input
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(true);
            let pw = '';
            process.stdin.on('data', (ch) => {
              const c = ch.toString();
              if (c === '\n' || c === '\r' || c === '\u0004') {
                process.stdin.setRawMode(false);
                process.stdout.write('\n');
                rl.close();
                resolve(pw);
              } else if (c === '\u007f' || c === '\b') {
                pw = pw.slice(0, -1);
              } else {
                pw += c;
              }
            });
          } else {
            rl.question('', (answer) => {
              rl.close();
              resolve(answer);
            });
          }
        });

        if (!password) {
          out.error('No password provided');
          process.exit(1);
        }

        if (password.length < 12) {
          out.error('Password must be at least 12 characters long');
          process.exit(1);
        }

        // Encrypt with AES-256-GCM
        const salt = crypto.randomBytes(16);
        const key = crypto.scryptSync(password, salt, 32);
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
        let encrypted = cipher.update(outputData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const authTag = cipher.getAuthTag().toString('hex');

        outputData = JSON.stringify({
          encrypted: true,
          algorithm: 'aes-256-gcm',
          salt: salt.toString('hex'),
          iv: iv.toString('hex'),
          authTag,
          data: encrypted,
        }, null, 2);

        filename = opts.output || `${name}.hazza.encrypted.json`;
        out.info('Backup encrypted with AES-256-GCM');
      }

      if (out.isJsonMode()) return out.json(opts.encrypt ? JSON.parse(outputData) : result);

      const outPath = path.resolve(filename);
      fs.writeFileSync(outPath, outputData, { mode: 0o600 });

      const recordCount = result.texts ? Object.keys(result.texts).length : 0;
      out.success(`Exported "${name}" (${recordCount} text records)`);
      out.info(`Saved to: ${outPath}`);
    } catch (e) {
      out.error(e.message);
      process.exit(1);
    }
  });

module.exports = cmd;
