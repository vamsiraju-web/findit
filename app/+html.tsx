import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <meta name="theme-color" content="#1A3A4A" />
        <meta name="description" content="FindIt - Voice-first smart belongings tracker" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="FindIt" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/assets/icon.png" />
        <title>FindIt</title>
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `body{overflow:hidden;height:100vh}#root{display:flex;height:100vh}` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
