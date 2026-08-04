import { defineBuildConfig } from "obuild/config"

export default defineBuildConfig({
  entries: [
    {
      type: "transform",
      input: "./src",
      outDir: "./dist",
      dts: true,
      // `cli.ts` / `_cli.ts` are bundled separately below so that citty and
      // consola never become runtime dependencies of the published package.
      // `env.d.ts` only carries ambient declarations for our own build — it
      // must not be shipped, or it would redeclare globals in consumers.
      filter: (file) => !/^_?cli\.ts$/.test(file) && !file.endsWith(".d.ts"),
    },
    {
      type: "bundle",
      input: "./src/cli.ts",
      outDir: "./dist",
      dts: false,
      rolldown: {
        plugins: [
          {
            name: "etiket-external-library",
            resolveId(id: string) {
              // Keep the library itself external: the CLI loads the transformed
              // build sitting next to it rather than inlining a second copy.
              if (id === "./index") {
                return { id: "./index.mjs", external: true }
              }
              return null
            },
          },
        ],
      },
    },
  ],
})
