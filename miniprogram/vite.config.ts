import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';
import path from 'path';

if (process.env.UNI_PLATFORM === 'mp-weixin' && process.env.ENABLE_UNI_DEV_SOCKET !== 'true') {
  delete process.env.UNI_SOCKET_HOSTS;
  delete process.env.UNI_SOCKET_PORT;
  delete process.env.UNI_SOCKET_ID;
}

export default defineConfig({
  plugins: [uni()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`,
      },
    },
  },
});
