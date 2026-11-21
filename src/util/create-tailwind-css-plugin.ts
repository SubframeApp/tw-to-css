import processTailwindFeatures from "tailwindcss/src/processTailwindFeatures.js";
import resolveConfig from "tailwindcss/src/public/resolve-config.js";
import { cloneContext, JitContext } from "tailwindcss/src/lib/setupContextUtils.js";
import { AcceptedPlugin } from "postcss";
import { TailwindConfig } from "tailwindcss/tailwindconfig.faketype";

type RegisteredContext = {
  resolvedConfig: TailwindConfig;
  // Built on first use, because it needs the `createContext` handed to the plugin.
  context: JitContext | null;
};

const MAX_CACHED_CONFIGS = 8;

const registeredContexts = new Map<string, RegisteredContext>();

// Returns null for configs whose JSON would drop functions (e.g. inline plugins) and so can't key the cache.
const configCacheKey = (config: TailwindConfig): string | null => {
  let serializable = true;
  const key = JSON.stringify(config, (_, value) => {
    if (typeof value === "function") serializable = false;
    return value;
  });
  return serializable ? key : null;
};

const getRegisteredContext = (config: TailwindConfig): RegisteredContext => {
  const key = configCacheKey(config);
  if (key === null) return { resolvedConfig: resolveConfig(config), context: null };

  const cached = registeredContexts.get(key);
  if (cached) return cached;

  const created: RegisteredContext = { resolvedConfig: resolveConfig(config), context: null };
  registeredContexts.set(key, created);
  if (registeredContexts.size > MAX_CACHED_CONFIGS) {
    registeredContexts.delete(registeredContexts.keys().next().value as string);
  }
  return created;
};

// Registering plugins is the expensive part of a context, and a class's output must not depend on
// which classes ran before it, so each call clones the registered context with empty caches
// (`cloneContext` is added to Tailwind by patches/tailwindcss+3.4.19.patch).
export const createTailwindcssPlugin = (props: {
  config?: TailwindConfig;
  content: string;
}): AcceptedPlugin => {
  const registered = getRegisteredContext(props.config ?? {});
  return processTailwindFeatures((processOptions) => () => {
    if (registered.context === null) {
      registered.context = processOptions.createContext(registered.resolvedConfig, []);
    }
    return cloneContext(registered.context, [{ content: props.content }]);
  });
};
