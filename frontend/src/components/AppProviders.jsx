import * as React from 'react';
import { ThemeProvider, createTheme, THEME_ID } from '@mui/material/styles';
import { CssVarsProvider, useColorScheme } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';

function MaterialThemeBridge({ children }) {
  const { mode } = useColorScheme();

  const materialTheme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode: mode === 'dark' ? 'dark' : 'light',
        },
        typography: {
          fontFamily:
            "var(--joy-fontFamily-body, Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif)",
        },
      }),
    [mode]
  );

  return <ThemeProvider theme={{ [THEME_ID]: materialTheme }}>{children}</ThemeProvider>;
}

export default function AppProviders({ children }) {
  return (
    <CssVarsProvider disableTransitionOnChange defaultMode="light" modeStorageKey="azify-mode">
      <CssBaseline />
      <MaterialThemeBridge>{children}</MaterialThemeBridge>
    </CssVarsProvider>
  );
}
