
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

export function VampireIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" strokeLinejoin="round" {...props}>
            <path d="M12.4,2.39,12,1.5,11.6.2.39A1.21,1.21,0,0,0,10.5,3.5a1.18,1.18,0,0,0,1,1,1.17,1.17,0,0,0,1-1A1.21,1.21,0,0,0,12.4,2.39Z"/>
            <path d="M19.16,6.33a3.5,3.5,0,0,0-1.89-2.73A10.34,10.34,0,0,0,12,3,10.34,10.34,0,0,0,6.73,3.6,3.5,3.5,0,0,0,4.84,6.33L4.2,12.9a8,8,0,0,0,15.6,0Z"/>
            <path d="M9.1,13.56a.5.5,0,0,0-.71,0L6.22,15.73a.5.5,0,0,0,0,.71l3.54,3.53a.5.5,0,0,0,.71,0l2.12-2.12a.5.5,0,0,0,0-.71Z"/>
            <path d="M14.9,13.56a.5.5,0,0,1,.71,0l2.12,2.17a.5.5,0,0,1,0,.71l-3.54,3.53a.5.5,0,0,1-.71,0L11.3,17.85a.5.5,0,0,1,0-.71Z"/>
        </svg>
    )
}
