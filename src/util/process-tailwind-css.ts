import postcss from "postcss";
import postcssVariables from "postcss-css-variables";
import { TailwindConfig } from "tailwindcss/tailwindconfig.faketype";
import { createTailwindcssPlugin, defaultTailwindCSS } from ".";
import { Options } from "../..";

export const processTailwindCSS = async (props: {
  config?: TailwindConfig;
  content: string;
  twiOptions?: Options;
}): Promise<string> => {
  const tailwindcssPlugin = createTailwindcssPlugin({
    config: props.config,
    content: props.content,
  });
  const plugins = [tailwindcssPlugin];
  if (props.twiOptions?.transformCssVariables) {
    plugins.push(postcssVariables());
  }
  const processor = postcss(plugins);
  const result = await processor.process(defaultTailwindCSS, { from: undefined });
  return result.css;
};
