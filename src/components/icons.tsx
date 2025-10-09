
import type { SVGProps } from 'react';
import { Skull } from 'lucide-react';

export const SkullIcon = Skull;

export function VillagerIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2L8 5v4l4 2 4-2V5z"/>
      <path d="M12 11l-4 2v4h8v-4l-4-2z"/>
      <path d="M20 9l-2 1v3.5l2 1zM4 9l2 1v3.5l-2 1z"/>
      <path d="M12 22v-3"/>
    </svg>
  );
}
