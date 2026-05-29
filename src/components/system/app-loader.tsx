import Image from "next/image";

type AppLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

export function AppLoader({ label = "Loading experience", fullScreen = true }: AppLoaderProps) {
  return (
    <div className={fullScreen ? "app-global-loading" : "app-inline-loading"} role="status" aria-live="polite" aria-busy>
      <div className="app-loader">
        <div className="app-loader__logo-wrap" aria-hidden>
          <Image src="/ftpr-admin-logo.svg" alt="" width={86} height={86} className="app-loader__logo" priority />
          <span className="app-loader__pulse app-loader__pulse--one" />
          <span className="app-loader__pulse app-loader__pulse--two" />
        </div>
        <p className="app-loader__text">{label}</p>
        <p className="app-loader__sub">
          Preparing the next screen
          <span className="app-loader__dots" aria-hidden>
            ...
          </span>
        </p>
      </div>
    </div>
  );
}
