import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base } from 'wagmi/chains';
import { QueryClient } from '@tanstack/react-query';

export const config = getDefaultConfig({
  appName: 'hazza',
  projectId: 'f08d656b170746b323bed0791b6a1882',
  chains: [base],
});

export const queryClient = new QueryClient();
