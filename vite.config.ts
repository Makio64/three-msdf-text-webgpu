import { defineConfig } from "vite";
import path from "path";
import dts from 'vite-plugin-dts';

export default defineConfig(() => {
  return {
    build: {
      lib: {
        entry: "src/index.ts",
        name: "three-msdf-text-webgpu",
        formats: ["es"],
        fileName: (_) => `index.js`,
      },
      emptyOutDir: true,
      rollupOptions: { 
        external: ["three", "three/webgpu", "three/tsl"]
      }
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    plugins: [dts({ rollupTypes: true })],
  };
});