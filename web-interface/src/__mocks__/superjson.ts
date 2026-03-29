export default {
  serialize: (v: unknown) => ({ json: v, meta: undefined }),
  deserialize: (v: { json: unknown }) => v.json,
  stringify: (v: unknown) => JSON.stringify(v),
  parse: (v: string) => JSON.parse(v),
};
