import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Neo-brutalist buttons (ported from midpoint-maps Button.js): thick borders,
// hard-offset shadow at rest, and on press/hover the shadow drops while the
// button nudges down-right so it reads as physically pushed in.
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-neo text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Solid, accent-filled primary.
        default:
          "border-3 border-accent bg-accent text-accent-foreground shadow-neo-sm hover:bg-accent-dark hover:border-accent-dark hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5",
        // Error-filled, same neo press behavior.
        destructive:
          "border-3 border-destructive bg-destructive text-destructive-foreground shadow-neo-sm hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5",
        // Bordered surface button that turns accent on hover.
        outline:
          "border-3 border-accent bg-transparent text-accent shadow-neo-sm hover:bg-accent/10 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5",
        // Tinted secondary variant.
        secondary:
          "border-3 border-accent/20 bg-secondary text-accent shadow-neo-sm hover:bg-accent/10 hover:shadow-none hover:translate-x-0.5 hover:translate-y-0.5",
        // Flat, no border/shadow.
        ghost: "hover:bg-accent/10 hover:text-accent",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
