import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import IconButton from '@mui/material/IconButton';
import { useRef } from 'react';
import type { ReactNode } from 'react';

type UiCarouselProps = {
  children: ReactNode;
  className?: string;
};

function joinClasses(...parts: Array<string | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

export function UiCarousel({ children, className }: UiCarouselProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const scrollByAmount = (delta: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className={joinClasses('ui-carousel', className)}>
      <IconButton
        size="small"
        className="ui-carousel-nav"
        onClick={() => scrollByAmount(-300)}
        aria-label="Cuộn sang trái"
      >
        <ChevronLeftIcon fontSize="small" />
      </IconButton>
      <div className="ui-carousel-track" ref={trackRef}>
        {children}
      </div>
      <IconButton
        size="small"
        className="ui-carousel-nav"
        onClick={() => scrollByAmount(300)}
        aria-label="Cuộn sang phải"
      >
        <ChevronRightIcon fontSize="small" />
      </IconButton>
    </div>
  );
}
