import { createContext, useContext } from 'react';
import type { NavigationTab } from '../types';

// React context crosses a portal, keeping form dialogs aligned with their page.
const ModuleAppearanceContext = createContext<NavigationTab | undefined>(undefined);
export const ModuleAppearanceProvider = ModuleAppearanceContext.Provider;
export const useModuleAppearance = () => useContext(ModuleAppearanceContext);
