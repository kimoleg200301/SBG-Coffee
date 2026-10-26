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
import { useQueryClient } from '@tanstack/react-query';
import {
  addCartItem,
  createEmptyCart,
  removeCartItem,
  resolveCart,
  setCartQuantity,
  MAX_COMMENT_LENGTH,
  type CartDraft,
  type ResolvedCartLine,
} from '@/domain/cart';
import { OrderCatalogChangedError, type Order } from '@/domain/orders';
import { catalogQueryKey } from '@/features/catalog/catalogQuery';
import { useCatalog } from '@/features/catalog/useCatalog';
import { useRepositories } from './RepositoriesProvider';

interface CartContextValue {
  draft: CartDraft;
  lines: readonly ResolvedCartLine[];
  totalKzt: number;
  itemCount: number;
  issues: readonly string[];
  isReady: boolean;
  isSubmitting: boolean;
  isSaving: boolean;
  error: string | null;
  retryLoad: () => Promise<void>;
  addItem: (productId: string, variantId: string, quantity?: number) => Promise<void>;
  setQuantity: (key: string, quantity: number) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
  setComment: (comment: string) => Promise<void>;
  clear: () => Promise<void>;
  submitOrder: () => Promise<Order>;
  replaceFromOrder: (order: Order) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);
const messageFor = (error: unknown) =>
  error instanceof Error ? error.message : 'Не удалось сохранить изменения. Попробуйте ещё раз.';

export function CartProvider({ children }: PropsWithChildren) {
  const repositories = useRepositories();
  const queryClient = useQueryClient();
  const catalog = useCatalog();
  const refetchCatalog = catalog.refetch;
  const [draft, setDraft] = useState<CartDraft>(createEmptyCart);
  const draftRef = useRef(draft);
  const [isHydrated, setIsHydrated] = useState(false);
  const readyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingWrites, setPendingWrites] = useState(0);
  const submittingRef = useRef(false);
  const submissionRef = useRef<Promise<Order> | null>(null);
  const writesRef = useRef<Promise<void>>(Promise.resolve());
  const aliveRef = useRef(true);
  const hydrationGeneration = useRef(0);

  const hydrate = useCallback(async () => {
    if (readyRef.current) return;
    const generation = ++hydrationGeneration.current;
    try {
      const saved = await repositories.cart.get();
      const orders = saved.items.length ? await repositories.orders.list() : [];
      if (!aliveRef.current || generation !== hydrationGeneration.current) return;
      const wasSubmitted = orders.some((order) => order.requestId === saved.id);
      const restored = wasSubmitted ? createEmptyCart() : saved;
      // An order is already durable even if the previous cart cleanup failed.
      if (wasSubmitted) await repositories.cart.save(restored).catch(() => {});
      if (!aliveRef.current || generation !== hydrationGeneration.current) return;
      draftRef.current = restored;
      readyRef.current = true;
      setDraft(restored);
      setIsHydrated(true);
      setError(null);
    } catch {
      if (aliveRef.current && generation === hydrationGeneration.current)
        setError('Не удалось прочитать корзину на устройстве. Попробуйте ещё раз.');
    }
  }, [repositories.cart, repositories.orders]);

  useEffect(() => {
    aliveRef.current = true;
    void Promise.resolve().then(hydrate);
    return () => {
      aliveRef.current = false;
      hydrationGeneration.current += 1;
    };
  }, [hydrate]);

  const resolved = useMemo(
    () => resolveCart(draft.items, catalog.data ?? []),
    [draft.items, catalog.data],
  );
  const assertEditable = useCallback(() => {
    if (!readyRef.current)
      throw new Error('Корзина ещё загружается. Попробуйте через несколько секунд.');
    if (submittingRef.current) throw new Error('Подождите, пока заказ будет сохранён.');
  }, []);

  const mutate = useCallback(
    (transform: (current: CartDraft) => CartDraft): Promise<void> => {
      try {
        assertEditable();
      } catch (cause) {
        return Promise.reject(cause);
      }
      setPendingWrites((count) => count + 1);
      // Serialize transitions, not just writes: a failed add must never leak into the next action.
      const pending = writesRef.current
        .catch(() => {})
        .then(async () => {
          const next = transform(draftRef.current);
          await repositories.cart.save(next);
          draftRef.current = next;
          if (aliveRef.current) {
            setDraft(next);
            setError(null);
          }
        })
        .catch((cause: unknown) => {
          if (aliveRef.current) setError(messageFor(cause));
          throw cause;
        })
        .finally(() => {
          if (aliveRef.current) setPendingWrites((count) => Math.max(0, count - 1));
        });
      writesRef.current = pending;
      return pending;
    },
    [assertEditable, repositories.cart],
  );

  const addItem = useCallback(
    async (productId: string, variantId: string, quantity = 1) => {
      const product = catalog.data?.find((item) => item.id === productId);
      if (!product?.variants.some((variant) => variant.id === variantId))
        throw new Error('Этот напиток пока недоступен. Обновите меню.');
      await mutate((current) => ({
        ...current,
        id: createEmptyCart().id,
        items: addCartItem(current.items, productId, variantId, quantity),
      }));
    },
    [catalog.data, mutate],
  );

  const setQuantity = useCallback(
    (key: string, quantity: number) =>
      mutate((current) => ({
        ...current,
        id: createEmptyCart().id,
        items: setCartQuantity(current.items, key, quantity),
      })),
    [mutate],
  );
  const removeItem = useCallback(
    (key: string) =>
      mutate((current) => ({
        ...current,
        id: createEmptyCart().id,
        items: removeCartItem(current.items, key),
      })),
    [mutate],
  );
  const setComment = useCallback(
    async (comment: string) => {
      if (comment.length > MAX_COMMENT_LENGTH)
        throw new Error(`Комментарий должен быть не длиннее ${MAX_COMMENT_LENGTH} символов.`);
      await mutate((current) =>
        current.comment === comment ? current : { ...current, id: createEmptyCart().id, comment },
      );
    },
    [mutate],
  );
  const clear = useCallback(() => mutate(() => createEmptyCart()), [mutate]);

  const replaceFromOrder = useCallback(
    async (order: Order) => {
      const items = order.items.map(({ productId, variantId, quantity }) => ({
        productId,
        variantId,
        quantity,
      }));
      const current = resolveCart(items, catalog.data ?? []);
      if (current.issues.length)
        throw new Error('Часть напитков больше недоступна. Выберите напитки из текущего меню.');
      await mutate(() => ({ ...createEmptyCart(), items, comment: order.comment }));
    },
    [catalog.data, mutate],
  );

  const submitOrder = useCallback((): Promise<Order> => {
    if (submissionRef.current) return submissionRef.current;
    try {
      assertEditable();
    } catch (cause) {
      return Promise.reject(cause);
    }
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);
    const pending = (async () => {
      await writesRef.current;
      const snapshot = draftRef.current;
      const current = resolveCart(snapshot.items, catalog.data ?? []);
      if (!current.lines.length || current.issues.length)
        throw new Error('Проверьте состав заказа: добавьте доступные напитки из меню.');
      await repositories.cart.save(snapshot);
      const order = await repositories.orders.create({
        requestId: snapshot.id,
        items: snapshot.items,
        comment: snapshot.comment,
        expectedTotalKzt: current.totalKzt,
      });
      queryClient.setQueryData(['orders', order.id], order);
      // Once creation commits, cleanup failure must not turn success into a duplicate order.
      const empty = createEmptyCart();
      await repositories.cart.save(empty).catch(() => {});
      draftRef.current = empty;
      if (aliveRef.current) setDraft(empty);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      return order;
    })()
      .catch((cause: unknown) => {
        if (cause instanceof OrderCatalogChangedError) {
          // Keep the draft and require explicit confirmation of the changed total.
          queryClient.setQueryData(catalogQueryKey(repositories.catalog), {
            products: cause.products,
            receivedAt: Date.now(),
            restored: false,
          });
        }
        if (aliveRef.current) setError(messageFor(cause));
        throw cause;
      })
      .finally(() => {
        submittingRef.current = false;
        submissionRef.current = null;
        if (aliveRef.current) setIsSubmitting(false);
      });
    submissionRef.current = pending;
    return pending;
  }, [assertEditable, catalog.data, queryClient, repositories.cart, repositories.orders, repositories.catalog]);

  const retryLoad = useCallback(async () => {
    if (!readyRef.current) await hydrate();
    else {
      await writesRef.current.catch(() => {});
      await repositories.cart.save(draftRef.current);
      setError(null);
    }
    await refetchCatalog();
  }, [hydrate, repositories.cart, refetchCatalog]);

  const value: CartContextValue = {
    draft,
    ...resolved,
    isReady: isHydrated && Boolean(catalog.data),
    isSubmitting,
    isSaving: pendingWrites > 0,
    error: error ?? (catalog.isError ? 'Не удалось загрузить меню. Попробуйте ещё раз.' : null),
    retryLoad,
    addItem,
    setQuantity,
    removeItem,
    setComment,
    clear,
    submitOrder,
    replaceFromOrder,
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error('CartProvider is missing');
  return value;
}
