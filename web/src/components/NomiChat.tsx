import ChatPanel from './ChatPanel';
import { NOMI_XMTP_ADDR } from '../config/contracts';
import { NOMI_AVATAR } from '../constants';

interface NomiChatProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function NomiChat({ isOpen, onClose }: NomiChatProps) {
  return (
    <ChatPanel
      isOpen={isOpen}
      onClose={onClose}
      targetAddress={NOMI_XMTP_ADDR}
      targetName="nomi"
      targetAvatar={NOMI_AVATAR}
      greeting="gm. i'm nomi. what's up?"
    />
  );
}
