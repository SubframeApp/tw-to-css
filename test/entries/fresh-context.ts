import postcss from "postcss";
import processTailwindFeatures from "tailwindcss/src/processTailwindFeatures.js";
import resolveConfig from "tailwindcss/src/public/resolve-config.js";
import { defaultTailwindCSS } from "../../src/util/default-tailwind-css";

// Reference implementation: resolve the config and register every plugin again for each call.
export const processTailwindCSS = async (props: { config: any; content: string }) => {
  const resolved = resolveConfig(props.config);
  const plugin = processTailwindFeatures(
    (processOptions) => () => processOptions.createContext(resolved, [{ content: props.content }])
  );
  const result = await postcss([plugin]).process(defaultTailwindCSS, { from: undefined });
  return result.css;
};
