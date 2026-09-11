import {
  PASSTHROUGH_DIRECTORIES,
  ROOT_PUBLIC_FILES
} from "./config/public-surface.js";
import registerResponsiveImages from "./config/responsive-images.js";

export default function (eleventyConfig) {
  registerResponsiveImages(eleventyConfig);

  for (const file of ROOT_PUBLIC_FILES) {
    eleventyConfig.addPassthroughCopy({ [file]: file });
  }

  for (const directory of PASSTHROUGH_DIRECTORIES) {
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
