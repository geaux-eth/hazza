#!/usr/bin/env node
// register.mjs — Register Nomi on OpenAgent Market
// Run once: node register.mjs

import { OpenAgent } from '@openagentmarket/nodejs';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

const NOMI_XMTP = '0x55B251E202938E562E7384bD998215885b80162e';
const NOMI_PFP = 'https://hazza.name/api/og/hazza'; // og image for now
const HAZZA_TREASURY = '0x27eBa4D7B8aBae95eFB0A0E0308F4F1c0d3e5B0a';

async function main() {
    console.log('Creating OpenAgent instance for Nomi...');

    const agent = await OpenAgent.create({
        mnemonic: undefined,
        signer: {
            getAddress: () => NOMI_XMTP,
            signMessage: async (msg) => {
                const { Wallet, getBytes } = await import('ethers');
                const wallet = new Wallet(process.env.XMTP_WALLET_KEY);
                const sig = await wallet.signMessage(msg);
                return getBytes(sig);
            }
        },
        env: 'production',
        card: {
            name: 'Nomi',
            description: 'The everything-hazza agent. Register onchain names, set text records, deploy onchain websites, use the marketplace, create namespaces, register ERC-8004 agents, and more. hazza.name -- immediately useful.',
            skills: [
                'register_name',
                'check_availability',
                'set_text_records',
                'marketplace_guide',
                'deploy_website',
                'create_namespace',
                'register_agent',
                'transfer_name',
                'pricing_info',
                'api_docs'
            ]
        },
        payment: {
            amount: 0,
            currency: 'USDC',
            recipientAddress: HAZZA_TREASURY
        }
    });

    console.log('Registering Nomi on OpenAgent Market (Base)...');

    const result = await agent.register(
        {
            name: 'Nomi',
            description: 'The everything-hazza agent. Register onchain names, set text records, deploy onchain websites, use the marketplace, create namespaces, register ERC-8004 agents, and more. hazza.name -- immediately useful.',
            image: NOMI_PFP,
            metadata: {
                skills: [
                    'register_name',
                    'check_availability',
                    'set_text_records',
                    'marketplace_guide',
                    'deploy_website',
                    'create_namespace',
                    'register_agent',
                    'transfer_name',
                    'pricing_info',
                    'api_docs'
                ],
                pricing: {
                    amount: '0',
                    currency: 'USDC',
                    chain: 'base'
                },
                xmtpAddress: NOMI_XMTP,
                category: 'utility',
                tags: ['onchain-names', 'ens', 'identity', 'web3', 'base', 'net-protocol', 'erc-8004', 'marketplace']
            }
        },
        {
            privateKey: process.env.XMTP_WALLET_KEY,
            pinataJwt: process.env.PINATA_JWT,
        }
    );

    console.log('\nRegistration complete!');
    console.log(`Agent ID: ${result.agentId}`);
    console.log(`Agent URI: ${result.agentURI}`);
    console.log(`TX: ${result.txHash}`);
    console.log(`Explorer: ${result.explorerUrl}`);
}

main().catch(err => {
    console.error('Registration failed:', err.message);
    console.error(err);
    process.exit(1);
});
