import { createTheme } from '@mui/material/styles';

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#3b82f6',
      dark: '#2563eb',
    },
    error: {
      main: '#ef4444',
    },
    background: {
      default: '#020617',
      paper: '#0f172a',
    },
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily:
      "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    button: {
      textTransform: 'none',
      fontWeight: 600,
    },
  },
});
