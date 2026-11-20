import React from "react";

interface BdGovLogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number | string;
}

export function BdGovLogo({ className = "w-10 h-10", size, ...props }: BdGovLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/bd-gov-logo.webp"
      alt="গণপ্রজাতন্ত্রী বাংলাদেশ সরকার"
      className={`shrink-0 object-contain drop-shadow-xs select-none ${className}`}
      style={size ? { width: size, height: size } : undefined}
      draggable={false}
    />
  );
}
