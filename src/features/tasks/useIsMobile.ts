import useMediaQuery from '@mui/material/useMediaQuery';

/** Phone-sized viewport; matches the 720px breakpoint used in `_layout.scss`. */
export function useIsMobile(): boolean {
  return useMediaQuery('(max-width: 720px)', { noSsr: true });
}
