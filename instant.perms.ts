import type { InstantRules } from "@instantdb/react";

// This is a public-link app — anyone with the URL can view and create entries.
// The tradeoff is intentional: no auth means no friction, but also no protection
// against abuse. update and delete are denied so nobody can tamper with existing data.
const rules = {
  entries: {
    allow: {
      view: "true",
      create: "true",
      update: "false",
      delete: "false",
    },
  },
  matches: {
    allow: {
      view: "true",
      create: "true",
      update: "false",
      delete: "false",
    },
  },
  matchPlayers: {
    allow: {
      view: "true",
      create: "true",
      update: "false",
      delete: "false",
    },
  },
  matchTitles: {
    allow: {
      view: "true",
      create: "true",
      update: "false",
      delete: "false",
    },
  },
} satisfies InstantRules;

export default rules;
