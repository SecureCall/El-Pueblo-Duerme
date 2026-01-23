
"use client";

import { PlaceHolderImages } from "@/lib/placeholder-images";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAvatar: (avatarUrl: string) => void;
}

export function AvatarSelectionModal({ isOpen, onClose, onSelectAvatar }: AvatarSelectionModalProps) {
  const avatarImages = PlaceHolderImages.filter(img => img.id.startsWith("avatar-"));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Elige tu Avatar</DialogTitle>
          <DialogDescription>
            Selecciona la imagen que te representará en el pueblo.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-96">
            <div className="grid grid-cols-4 gap-4 p-4">
            {avatarImages.map(avatar => (
                <div 
                    key={avatar.id} 
                    className="aspect-square relative rounded-md overflow-hidden cursor-pointer transition-transform hover:scale-105"
                    onClick={() => onSelectAvatar(avatar.imageUrl)}
                >
                <Image 
                    src={avatar.imageUrl}
                    alt={avatar.description}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 25vw, 150px"
                />
                </div>
            ))}
            </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
