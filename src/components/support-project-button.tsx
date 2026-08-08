"use client";

import Image from "next/image";
import { HandCoins } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function SupportProjectButton() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2"
          aria-label="Support this project"
        >
          <HandCoins className="h-4 w-4" />
          <span className="hidden md:inline">Support this project</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Support this project</DialogTitle>
          <DialogDescription className="leading-relaxed">
            VinUni Course Planner is completely free to use. If you find it
            helpful, an optional contribution can help cover the domain,
            hosting, and ongoing maintenance.
          </DialogDescription>
        </DialogHeader>

        <figure className="space-y-3">
          <div className="mx-auto w-fit overflow-hidden rounded-lg border bg-white p-2 shadow-sm">
            <Image
              src="/qr-code.jpg"
              alt="Bank transfer QR code for supporting VinUni Course Planner"
              width={1154}
              height={1281}
              className="max-h-[55vh] w-auto max-w-full object-contain"
              priority={false}
            />
          </div>
          <figcaption className="text-center text-sm font-medium">
            Scan the QR code with your banking app to make a transfer.
          </figcaption>
        </figure>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Supporting the project is entirely optional and does not unlock any
          additional features. Thank you for helping keep it available.
        </p>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
