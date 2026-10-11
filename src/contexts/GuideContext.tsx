import React, { createContext, useContext } from 'react';

interface GuideContextType {}

const GuideContext = createContext<GuideContextType | undefined>(undefined);

export const GuideProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <GuideContext.Provider value={{}}>
      {children}
    </GuideContext.Provider>
  );
};

export const useGuide = (): GuideContextType => {
  const context = useContext(GuideContext);
  return context || {};
};
