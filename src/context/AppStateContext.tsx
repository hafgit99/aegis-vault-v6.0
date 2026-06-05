import React, { createContext, useContext, useMemo, useReducer } from 'react';
import type { SecurityLog } from '../components/SecurityLogsModal';
import { VaultEntry } from '../types';
import { DEFAULT_AVATAR_URL, normalizeAvatarUrl } from '../lib/avatarPresets';

type SetValue<T> = React.SetStateAction<T>;

export interface AppState {
  isLocked: boolean;
  activeTab: string;
  entries: VaultEntry[];
  searchQuery: string;
  filterType: string;
  isAddModalOpen: boolean;
  selectedEntry: VaultEntry | null;
  isProfileModalOpen: boolean;
  isDatabaseModalOpen: boolean;
  isLogsModalOpen: boolean;
  isLanguageMenuOpen: boolean;
  userName: string;
  avatarUrl: string;
  isSyncing: boolean;
  logs: SecurityLog[];
  toastMessage: string | null;
  visibleCount: number;
}

type AppStateAction =
  | { type: 'setIsLocked'; value: SetValue<boolean> }
  | { type: 'setActiveTab'; value: SetValue<string> }
  | { type: 'setEntries'; value: SetValue<VaultEntry[]> }
  | { type: 'setSearchQuery'; value: SetValue<string> }
  | { type: 'setFilterType'; value: SetValue<string> }
  | { type: 'setIsAddModalOpen'; value: SetValue<boolean> }
  | { type: 'setSelectedEntry'; value: SetValue<VaultEntry | null> }
  | { type: 'setIsProfileModalOpen'; value: SetValue<boolean> }
  | { type: 'setIsDatabaseModalOpen'; value: SetValue<boolean> }
  | { type: 'setIsLogsModalOpen'; value: SetValue<boolean> }
  | { type: 'setIsLanguageMenuOpen'; value: SetValue<boolean> }
  | { type: 'setUserName'; value: SetValue<string> }
  | { type: 'setAvatarUrl'; value: SetValue<string> }
  | { type: 'setIsSyncing'; value: SetValue<boolean> }
  | { type: 'setLogs'; value: SetValue<SecurityLog[]> }
  | { type: 'setToastMessage'; value: SetValue<string | null> }
  | { type: 'setVisibleCount'; value: SetValue<number> };

export interface AppStateActions {
  setIsLocked: React.Dispatch<SetValue<boolean>>;
  setActiveTab: React.Dispatch<SetValue<string>>;
  setEntries: React.Dispatch<SetValue<VaultEntry[]>>;
  setSearchQuery: React.Dispatch<SetValue<string>>;
  setFilterType: React.Dispatch<SetValue<string>>;
  setIsAddModalOpen: React.Dispatch<SetValue<boolean>>;
  setSelectedEntry: React.Dispatch<SetValue<VaultEntry | null>>;
  setIsProfileModalOpen: React.Dispatch<SetValue<boolean>>;
  setIsDatabaseModalOpen: React.Dispatch<SetValue<boolean>>;
  setIsLogsModalOpen: React.Dispatch<SetValue<boolean>>;
  setIsLanguageMenuOpen: React.Dispatch<SetValue<boolean>>;
  setUserName: React.Dispatch<SetValue<string>>;
  setAvatarUrl: React.Dispatch<SetValue<string>>;
  setIsSyncing: React.Dispatch<SetValue<boolean>>;
  setLogs: React.Dispatch<SetValue<SecurityLog[]>>;
  setToastMessage: React.Dispatch<SetValue<string | null>>;
  setVisibleCount: React.Dispatch<SetValue<number>>;
}

interface AppStateContextValue {
  state: AppState;
  actions: AppStateActions;
}

const AppStateContext = createContext<AppStateContextValue | null>(null);

const resolve = <T,>(value: SetValue<T>, previous: T): T => (
  typeof value === 'function'
    ? (value as (previousValue: T) => T)(previous)
    : value
);

const readInitialUserName = (defaultUserName: string): string => {
  try {
    return localStorage.getItem('aegis_user_name') || defaultUserName;
  } catch {
    return defaultUserName;
  }
};

const readInitialAvatarUrl = (): string => {
  try {
    const savedAvatarUrl = localStorage.getItem('aegis_user_avatar');
    const normalizedAvatarUrl = normalizeAvatarUrl(savedAvatarUrl);

    if (savedAvatarUrl && savedAvatarUrl !== normalizedAvatarUrl) {
      localStorage.setItem('aegis_user_avatar', normalizedAvatarUrl);
    }

    return normalizedAvatarUrl;
  } catch {
    return DEFAULT_AVATAR_URL;
  }
};

const createInitialState = (defaultUserName: string): AppState => ({
  isLocked: true,
  activeTab: 'vault',
  entries: [],
  searchQuery: '',
  filterType: 'all',
  isAddModalOpen: false,
  selectedEntry: null,
  isProfileModalOpen: false,
  isDatabaseModalOpen: false,
  isLogsModalOpen: false,
  isLanguageMenuOpen: false,
  userName: readInitialUserName(defaultUserName),
  avatarUrl: readInitialAvatarUrl(),
  isSyncing: false,
  logs: [],
  toastMessage: null,
  visibleCount: 50,
});

function appStateReducer(state: AppState, action: AppStateAction): AppState {
  switch (action.type) {
    case 'setIsLocked':
      return { ...state, isLocked: resolve(action.value, state.isLocked) };
    case 'setActiveTab':
      return { ...state, activeTab: resolve(action.value, state.activeTab) };
    case 'setEntries':
      return { ...state, entries: resolve(action.value, state.entries) };
    case 'setSearchQuery':
      return { ...state, searchQuery: resolve(action.value, state.searchQuery) };
    case 'setFilterType':
      return { ...state, filterType: resolve(action.value, state.filterType) };
    case 'setIsAddModalOpen':
      return { ...state, isAddModalOpen: resolve(action.value, state.isAddModalOpen) };
    case 'setSelectedEntry':
      return { ...state, selectedEntry: resolve(action.value, state.selectedEntry) };
    case 'setIsProfileModalOpen':
      return { ...state, isProfileModalOpen: resolve(action.value, state.isProfileModalOpen) };
    case 'setIsDatabaseModalOpen':
      return { ...state, isDatabaseModalOpen: resolve(action.value, state.isDatabaseModalOpen) };
    case 'setIsLogsModalOpen':
      return { ...state, isLogsModalOpen: resolve(action.value, state.isLogsModalOpen) };
    case 'setIsLanguageMenuOpen':
      return { ...state, isLanguageMenuOpen: resolve(action.value, state.isLanguageMenuOpen) };
    case 'setUserName':
      return { ...state, userName: resolve(action.value, state.userName) };
    case 'setAvatarUrl':
      return { ...state, avatarUrl: resolve(action.value, state.avatarUrl) };
    case 'setIsSyncing':
      return { ...state, isSyncing: resolve(action.value, state.isSyncing) };
    case 'setLogs':
      return { ...state, logs: resolve(action.value, state.logs) };
    case 'setToastMessage':
      return { ...state, toastMessage: resolve(action.value, state.toastMessage) };
    case 'setVisibleCount':
      return { ...state, visibleCount: resolve(action.value, state.visibleCount) };
    default:
      return state;
  }
}

interface AppStateProviderProps {
  children: React.ReactNode;
  defaultUserName: string;
}

export function AppStateProvider({ children, defaultUserName }: AppStateProviderProps) {
  const [state, dispatch] = useReducer(
    appStateReducer,
    defaultUserName,
    createInitialState
  );

  const actions = useMemo<AppStateActions>(() => ({
    setIsLocked: (value) => dispatch({ type: 'setIsLocked', value }),
    setActiveTab: (value) => dispatch({ type: 'setActiveTab', value }),
    setEntries: (value) => dispatch({ type: 'setEntries', value }),
    setSearchQuery: (value) => dispatch({ type: 'setSearchQuery', value }),
    setFilterType: (value) => dispatch({ type: 'setFilterType', value }),
    setIsAddModalOpen: (value) => dispatch({ type: 'setIsAddModalOpen', value }),
    setSelectedEntry: (value) => dispatch({ type: 'setSelectedEntry', value }),
    setIsProfileModalOpen: (value) => dispatch({ type: 'setIsProfileModalOpen', value }),
    setIsDatabaseModalOpen: (value) => dispatch({ type: 'setIsDatabaseModalOpen', value }),
    setIsLogsModalOpen: (value) => dispatch({ type: 'setIsLogsModalOpen', value }),
    setIsLanguageMenuOpen: (value) => dispatch({ type: 'setIsLanguageMenuOpen', value }),
    setUserName: (value) => dispatch({ type: 'setUserName', value }),
    setAvatarUrl: (value) => dispatch({ type: 'setAvatarUrl', value }),
    setIsSyncing: (value) => dispatch({ type: 'setIsSyncing', value }),
    setLogs: (value) => dispatch({ type: 'setLogs', value }),
    setToastMessage: (value) => dispatch({ type: 'setToastMessage', value }),
    setVisibleCount: (value) => dispatch({ type: 'setVisibleCount', value }),
  }), []);

  const contextValue = useMemo(() => ({ state, actions }), [actions, state]);

  return (
    <AppStateContext.Provider value={contextValue}>
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState(): AppStateContextValue {
  const value = useContext(AppStateContext);
  if (!value) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return value;
}
