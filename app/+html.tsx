import { ScrollViewStyleReset } from 'expo-router/html';
import type { ReactNode } from 'react';

// This file is web-only and used to configure the root HTML for every
// web page during static rendering.
// The contents of this function only run in Node.js environments and
// do not have access to the DOM or browser APIs.
export default function Root({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#000000" />
        <title>MNEMO</title>

        {/*
          Disable body scrolling on web. This makes ScrollView components work closer to how they do on native.
          However, body scrolling is often nice to have for mobile web. If you want to enable it, remove this line.
        */}
        <ScrollViewStyleReset />

        {/* Raw CSS ensuring permanent dark background across web canvas, preventing light flashes and white overscroll */}
        <style dangerouslySetInnerHTML={{ __html: permanentDarkStyles }} />
        {/* Add any additional <head> elements that you want globally available on web... */}
      </head>
      <body style={{ backgroundColor: '#000000', color: '#ffffff' }}>{children}</body>
    </html>
  );
}

const permanentDarkStyles = `
html, body, #root {
  background-color: #000000 !important;
  color: #ffffff;
  min-height: 100%;
  overscroll-behavior-y: none;
}
`;
