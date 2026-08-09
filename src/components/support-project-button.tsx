"use client";

import Image from "next/image";
import { HeartHandshake, TriangleAlert } from "lucide-react";

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
          size="sm"
          className="rounded-full shadow-sm"
          aria-label="Support this project"
        >
          <HeartHandshake className="size-4.5" strokeWidth={2.25} />
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

        <div className="flex gap-3 rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm font-medium leading-relaxed text-yellow-950 dark:border-yellow-700 dark:bg-yellow-950/30 dark:text-yellow-100">
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0 text-yellow-600 dark:text-yellow-400"
            aria-hidden="true"
          />
          <p>
            Supporting the project is entirely optional and does not unlock any
            additional features. Thank you for helping keep it available.
          </p>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Close</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
