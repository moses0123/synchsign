import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({ baseDirectory: import.meta.dirname });
export default [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  // Signatures are data: URLs — next/image adds nothing there
  { rules: { "@next/next/no-img-element": "off" } },
];
