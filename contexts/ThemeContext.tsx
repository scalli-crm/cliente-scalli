
import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';
export type LayoutTheme = 'default' | 'addash';

interface ThemeContextType {
  theme: Theme;
  layoutTheme: LayoutTheme;
  toggleTheme: () => void;
  setLayoutTheme: (theme: LayoutTheme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = localStorage.getItem('app_theme');
    return (savedTheme as Theme) || 'dark';
  });

  const [layoutTheme, setLayoutThemeState] = useState<LayoutTheme>(() => {
    const savedLayout = localStorage.getItem('app_layout_theme');
    return (savedLayout as LayoutTheme) || 'default';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Handle Light/Dark Mode Class
    root.classList.remove(theme === 'dark' ? 'light' : 'dark');
    root.classList.add(theme);
    localStorage.setItem('app_theme', theme);

    // Handle Layout Theme Attribute
    if (layoutTheme === 'addash') {
      root.setAttribute('data-theme', 'addash');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem('app_layout_theme', layoutTheme);

  }, [theme, layoutTheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const setLayoutTheme = (newTheme: LayoutTheme) => {
    setLayoutThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, layoutTheme, toggleTheme, setLayoutTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
