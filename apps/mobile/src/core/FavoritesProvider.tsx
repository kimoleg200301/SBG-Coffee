import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

const STORAGE_KEY = 'sbg-coffee:favorites:v1';
interface FavoritesContextValue {
  favoriteIds: readonly string[];
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => void;
  isReady: boolean;
}
const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: PropsWithChildren) {
  const [favoriteIds, setFavoriteIds] = useState<readonly string[]>([]);
  const [isReady, setIsReady] = useState(false);
  const pendingToggles = useRef<string[]>([]);
  const writes = useRef(Promise.resolve());

  useEffect(() => {
    let alive = true;
    async function hydrate() {
      let saved: string[] = [];
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        const value: unknown = raw ? JSON.parse(raw) : [];
        if (Array.isArray(value))
          saved = [...new Set(value.filter((id): id is string => typeof id === 'string'))];
      } catch {
        // Storage is optional. Favorites still work for this app session.
      }
      if (!alive) return;
      for (const id of pendingToggles.current)
        saved = saved.includes(id) ? saved.filter((entry) => entry !== id) : [...saved, id];
      pendingToggles.current = [];
      setFavoriteIds(saved);
      setIsReady(true);
    }
    void hydrate();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    // Serialize writes so a slower old write cannot replace the latest selection.
    writes.current = writes.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favoriteIds)))
      .catch(() => {});
  }, [favoriteIds, isReady]);

  const toggleFavorite = useCallback(
    (id: string) => {
      if (!isReady) pendingToggles.current.push(id);
      setFavoriteIds((current) =>
        current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id],
      );
    },
    [isReady],
  );
  const value = useMemo(
    () => ({
      favoriteIds,
      isReady,
      toggleFavorite,
      isFavorite: (id: string) => favoriteIds.includes(id),
    }),
    [favoriteIds, isReady, toggleFavorite],
  );
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites(): FavoritesContextValue {
  const value = useContext(FavoritesContext);
  if (!value) throw new Error('FavoritesProvider is missing');
  return value;
}
