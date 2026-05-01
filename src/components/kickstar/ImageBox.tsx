import Image from "next/image";
import type { ReactNode } from "react";

type Base = {
  src: string;
  alt: string;
  overlay?: ReactNode;
  className?: string;
  /** 1–100. Higher = larger output from the optimizer (when not unoptimized). */
  quality?: number;
  priority?: boolean;
  /** Skip Next image optimizer — use for small PNG masters you want served bit-for-bit. */
  unoptimized?: boolean;
};

export type KickstarImageBoxProps =
  | (Base & {
      /** Full-bleed layer (parent must be `position: relative` with defined height). */
      fill: true;
      sizes: string;
    })
  | (Base & {
      fill?: false;
      width: number;
      height: number;
      sizes?: string;
    });

/** `image-box` — media + optional overlay; use `fill` for hero / cover layouts */
export function KickstarImageBox(props: KickstarImageBoxProps) {
  const { src, alt, overlay, className = "", quality, priority, unoptimized } = props;
  const q = quality ?? 92;

  if ("fill" in props && props.fill) {
    return (
      <div className={`ks-w-image-box ks-w-image-box--fill ${className}`.trim()}>
        <Image
          src={src}
          alt={alt}
          fill
          sizes={props.sizes}
          {...(unoptimized ? {} : { quality: q })}
          priority={priority}
          unoptimized={unoptimized}
          className="ks-w-image-box__img ks-w-image-box__img--cover"
        />
        {overlay ? <div className="ks-w-image-box__overlay">{overlay}</div> : null}
      </div>
    );
  }

  const { width, height } = props;
  const sizes =
    props.sizes ?? `(max-width: ${width}px) 100vw, ${Math.min(width, 1920)}px`;

  return (
    <div className={`ks-w-image-box ${className}`.trim()}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        {...(unoptimized ? {} : { quality: q })}
        priority={priority}
        unoptimized={unoptimized}
        className="ks-w-image-box__img"
      />
      {overlay ? <div className="ks-w-image-box__overlay">{overlay}</div> : null}
    </div>
  );
}
