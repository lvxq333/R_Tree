import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from 'react-error-boundary';
import { ThemeProvider } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import RoutesComponent from './app';
import './index.css';
createRoot(document.getElementById('root')!).render(
  <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
    <BrowserRouter><ErrorBoundary fallbackRender={({error}) => <div role="alert">页面加载失败：{String(error)}</div>}>
      <RoutesComponent /><Toaster />
    </ErrorBoundary></BrowserRouter>
  </ThemeProvider>
);
