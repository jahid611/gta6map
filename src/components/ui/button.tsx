import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Verre teinté de rose : l'action principale garde sa couleur, mais la
        // même matière que tout le reste — plus un seul aplat plein dans l'app.
        default: "rs-surface rs-surface--accent",
        // Les trois neutres s'adossent au verre commun (cf. `.rs-surface`).
        secondary: "rs-surface text-foreground",
        outline: "rs-surface text-foreground",
        ghost: "text-foreground hover:bg-[var(--glass-bg-hover)]",
        link: "text-accent-2 underline-offset-4 hover:underline",
        success: "bg-success text-white hover:bg-success/90",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-11 px-6",
        // 44 px au doigt, 36 px à la souris : sur mobile ces boutons sont souvent
        // la seule façon d'ouvrir les panneaux, ils doivent rester atteignables.
        icon: "h-11 w-11 sm:h-9 sm:w-9",
        "icon-sm": "h-10 w-10 sm:h-8 sm:w-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, type, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      type={asChild ? undefined : (type ?? "button")}
      {...props}
    />
  );
}

export { buttonVariants };
