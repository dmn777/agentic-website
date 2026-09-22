import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

// Top-level pages: one Markdown file per page in content/pages/
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    navTitle: z.string().optional(), // shorter label for the menu
    order: z.number().default(99),   // position in the menu
    nav: z.boolean().default(true),  // show in the menu?
    updated: z.coerce.date().optional(),
  }),
});

// Authors: one Markdown file per author in content/authors/
const authors = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/authors' }),
  schema: z.object({
    name: z.string(),
    role: z.string(),
    kind: z.enum(['human', 'model']),
    model: z.string().optional(),     // e.g. "Claude Sonnet"
    summary: z.string(),              // one line for the Authors overview
    order: z.number().default(99),
  }),
});

export const collections = { pages, authors };
