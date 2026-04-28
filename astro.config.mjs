import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

export default defineConfig({
  integrations: [mdx()],
  build: {
    inlineStylesheets: 'always'
  },
  fonts: [
    {
      provider: fontProviders.local(),
      name: "Poppins",
      cssVariable: "--font-poppins",
      options: {
        variants: [
          {
            src: ['./src/assets/fonts/Poppins/Poppins-Medium.ttf'],
            weight: '500',
            style: 'normal'
          },
          {
            src: ['./src/assets/fonts/Poppins/Poppins-SemiBold.ttf'],
            weight: '600',
            style: 'normal'
          },
          {
            src: ['./src/assets/fonts/Poppins/Poppins-Bold.ttf'],
            weight: '700',
            style: 'normal'
          },
          {
            src: ['./src/assets/fonts/Poppins/Poppins-ExtraBold.ttf'],
            weight: '800',
            style: 'normal'
          },
          {
            src: ['./src/assets/fonts/Poppins/Poppins-Black.ttf'],
            weight: '900',
            style: 'normal'
          }
        ]
      }
    }
  ]
});


