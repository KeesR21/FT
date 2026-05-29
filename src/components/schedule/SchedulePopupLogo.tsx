import Image from "next/image";

/** Academy logo shown at the top of schedule detail popups. */
export function SchedulePopupLogo() {
  return (
    <div className="schedule-popup-logo">
      <Image
        src="/logo.jpeg"
        alt="FTPR Lions Academy"
        width={80}
        height={80}
        className="schedule-popup-logo__img"
        priority
        unoptimized
        crossOrigin="anonymous"
      />
    </div>
  );
}
