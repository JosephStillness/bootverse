"use client";

import type { ReactElement, ReactNode, ComponentProps } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { XIcon } from "@/components/icons";
import { Button } from "./button";

export function Sheet({
  trigger,
  title,
  description,
  children,
  footer,
  finalFocus,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
  finalFocus?: ComponentProps<typeof Dialog.Popup>["finalFocus"];
}) {
  return (
    <Dialog.Root>
      <Dialog.Trigger render={trigger} />
      <Dialog.Portal>
        <Dialog.Backdrop className="sheet-backdrop" />
        <Dialog.Popup className="sheet-popup" finalFocus={finalFocus}>
          <div className="sheet-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>{description}</Dialog.Description>
            </div>
            <Dialog.Close
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Close ${title.toLowerCase()}`}
                >
                  <XIcon size={22} aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <div className="sheet-body">{children}</div>
          {footer && <div className="sheet-footer">{footer}</div>}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export const SheetClose = Dialog.Close;
