import {
  PUBLIC_DIRECTORIES,
  ROOT_HTML_FILES,
  ROOT_PUBLIC_FILES
} from "./config/public-surface.js";

export default function (eleventyConfig) {
  for (const file of [...ROOT_HTML_FILES, ...ROOT_PUBLIC_FILES]) {
    eleventyConfig.addPassthroughCopy({ [file]: file });
  }

  for (const directory of PUBLIC_DIRECTORIES) {
    eleventyConfig.addPassthroughCopy({ [directory]: directory });
  }

  return {
    dir: {
      input: "src",
      includes: "_includes",
      data: "_data",
      output: "_site"
    },
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk"
  };
}
