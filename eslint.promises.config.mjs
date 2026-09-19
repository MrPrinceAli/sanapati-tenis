// Pemeriksaan khusus (butuh info tipe, jadi lebih lambat): `npm run lint:promises`.
// Menangkap promise yang tidak di-await — tidak terlihat oleh TypeScript, tapi di serverless berarti penulisan database bisa tidak pernah selesai.
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.{ts,tsx}"],
  languageOptions: { parser: tseslint.parser, parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
  plugins: { "@typescript-eslint": tseslint.plugin },
  rules: {
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: false }],
    "@typescript-eslint/await-thenable": "error",
  },
});
