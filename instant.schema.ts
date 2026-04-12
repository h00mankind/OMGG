import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    entries: i.entity({
      playerId: i.string().indexed(),
      title: i.string().indexed(),
      kind: i.string().indexed(),
      createdAt: i.date(),
    }),
  },
});

type AppSchema = typeof _schema;
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
