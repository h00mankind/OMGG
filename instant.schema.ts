import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    entries: i.entity({
      playerId: i.string().indexed(),
      title: i.string().indexed(),
      kind: i.string().indexed(),
      createdAt: i.date(),
    }),
    matches: i.entity({
      title: i.string().indexed(),
      externalMatchId: i.string().optional(),
      durationSeconds: i.number(),
      winningSide: i.string(),
      playedAt: i.date(),
      createdAt: i.date(),
    }),
    matchPlayers: i.entity({
      playerId: i.string().optional().indexed(),
      displayName: i.string(),
      side: i.string(),
      hero: i.string(),
      kills: i.number(),
      deaths: i.number(),
      assists: i.number(),
      netWorth: i.number(),
      mmrChange: i.number().optional(),
      won: i.boolean(),
      createdAt: i.date(),
    }),
  },
  links: {
    matchPlayersMatch: {
      forward: { on: "matchPlayers", label: "match", has: "one" },
      reverse: { on: "matches", label: "players", has: "many" },
    },
  },
});

type AppSchema = typeof _schema;
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
