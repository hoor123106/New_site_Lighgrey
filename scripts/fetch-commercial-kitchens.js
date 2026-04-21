import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1vYOk_nJd3TYtToQt1HOPMBnNoeOqp6h06QwFiO1yxT4/gviz/tq?tqx=out:csv&gid=0';

function escapeMDX(str) {
    if (!str) return '';
    return str.replace(/\{/g, '&#123;').replace(/\}/g, '&#125;');
}

async function fetchAndGenerate() {
    console.log('Fetching Commercial Kitchens Sheet data...');
    const response = await fetch(SHEET_URL);
    const csvText = await response.text();

    if (!response.ok) {
        throw new Error(
            `Sheet fetch failed: ${response.status}\nFirst bytes: ${JSON.stringify(csvText.slice(0, 160))}`
        );
    }

    const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
    });

    const contentDir = path.join(process.cwd(), 'src', 'content', 'commercial-kitchens');

    if (fs.existsSync(contentDir)) {
        console.log('Cleaning old MDX files for sync...');
        const files = fs.readdirSync(contentDir);
        for (const file of files) {
            if (file.endsWith('.mdx')) {
                fs.unlinkSync(path.join(contentDir, file));
            }
        }
    } else {
        fs.mkdirSync(contentDir, { recursive: true });
    }

    records.forEach((row, index) => {
        // Robust Column Detection (Handle case-insensitivity and variations)
        const getVal = (keys) => {
            const key = Object.keys(row).find(k => keys.includes(k.trim().toLowerCase()));
            return key ? row[key]?.trim() : null;
        };

        const title = getVal(['title', 'industry title', 'heading', 'name']) || '';
        let rawSlug = getVal(['slug', 'url', 'id']) || 
                      title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 
                      '';

        const isPublished = getVal(['publish', 'published', 'status'])?.toLowerCase();
        if (isPublished !== 'y') {
            console.log(`Skipping unpublished kitchen at index ${index} (Publish: ${isPublished})`);
            return;
        }

        if (!rawSlug && !title) {
            console.log(`Skipping empty row at index ${index}`);
            return;
        }

        // Extract last part of path if it's a URL or contains slashes
        let slug = rawSlug;
        if (slug.includes('/') || slug.startsWith('http')) {
            try {
                if (slug.startsWith('http')) {
                    slug = new URL(slug).pathname;
                }
                slug = slug.split('/').filter(Boolean).pop() || '';
            } catch (e) {
                slug = slug.split('/').filter(Boolean).pop() || '';
            }
        }

        // Ensure slug is not empty after extraction
        slug = slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-') || `kitchen-${index}`;

        // Final clean
        slug = slug.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

        // Frontmatter — mapping using flexible keys
        const frontmatter = {
            title: title,
            metaTitle: getVal(['meta title', 'seotitle', 'seo title']) || '',
            slug: slug,
            category: getVal(['category', 'type']) || '',
            metaDescription: getVal(['meta description', 'meta desc']) || '',
            heroTitle: getVal(['hero title', 'main title']) || '',
            heroSubtitle: getVal(['hero subtitle', 'sub title']) || '',
            ourProcessSubtitle: getVal(['our process subtitle', 'process subtitle']) || '',
            ourProcessTitle: getVal(['our process title', 'process title']) || '',
            ourProcessDescription: getVal(['our process description', 'process description']) || '',
            footNote: getVal(['foot note', 'footnote']) || '',
        };

        // Dynamic detection of all features and CTAs
        Object.keys(row).forEach(k => {
            const trimmedKey = k.trim().toLowerCase();
            
            // Features
            const featureMatch = trimmedKey.match(/^feature\s*(\d+)\s*(image|alt|title|description)$/i);
            if (featureMatch) {
                const num = featureMatch[1];
                const type = featureMatch[2].toLowerCase();
                const cleanType = type === 'description' ? 'Description' : type.charAt(0).toUpperCase() + type.slice(1);
                let val = row[k]?.trim() || '';
                if (type === 'image' && val) {
                    val = `../../assets/images/commercial-kitchens/${val}`;
                }
                frontmatter[`feature${num}${cleanType}`] = val;
            }

            // CTAs
            const ctaMatch = trimmedKey.match(/^cta\s*(\d+)\s*(icon|title|description)$/i);
            if (ctaMatch) {
                const num = ctaMatch[1];
                const type = ctaMatch[2].toLowerCase();
                const cleanType = type === 'description' ? 'Description' : type.charAt(0).toUpperCase() + type.slice(1);
                frontmatter[`cta${num}${cleanType}`] = row[k]?.trim() || '';
            }
        });

        // MDX file generation
        let mdxContent = `---\n`;
        for (const [key, value] of Object.entries(frontmatter)) {
            mdxContent += `${key}: ${JSON.stringify(value)}\n`;
        }
        mdxContent += `---\n\n`;

        // We DO NOT append Process or Foot Note here because they are handled in the structured [slug].astro template
        // We only put the main body content if there's any overflow content (usually empty in this sheet structure)
        if (row['Content'] || row['Body']) {
            mdxContent += `${escapeMDX(row['Content'] || row['Body'])}\n\n`;
        }

        const filePath = path.join(contentDir, `${slug}.mdx`);
        fs.writeFileSync(filePath, mdxContent, 'utf-8');
        console.log(`Synced: ${slug}.mdx`);
    });

    console.log('Commercial Kitchens sync complete!');
}

fetchAndGenerate().catch(console.error);