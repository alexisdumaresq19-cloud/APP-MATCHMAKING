declare module "@animated-color-icons/lucide-react/*" {
  import type { ComponentType, SVGProps } from "react";
  export type AnimatedIconProps = SVGProps<SVGSVGElement> & {
    size?: number | string;
    primaryColor?: string;
    secondaryColor?: string;
    title?: string;
  };
  const Icon: ComponentType<AnimatedIconProps>;
  export default Icon;
}
